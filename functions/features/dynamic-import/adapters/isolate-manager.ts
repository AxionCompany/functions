import { match } from "npm:path-to-regexp";

const subprocesses: any = {};
const responseHandlers: any = {};
const resolver: any = {};
const urlMetadatas: any = {};

export default (config: any) => async (params: any, response: any) => {
    const { currentUrl, importUrl, pathParams, queryParams, data, __requestId__ } = params;

    const importSearchParams = new URL(importUrl).searchParams.toString();

    let urlMetadata;
    let isJSX = false;

    for (const key in urlMetadatas) {
        const regexp = match(key, { decode: decodeURIComponent });
        const matched = regexp(importUrl.pathname);
        if (matched) {
            urlMetadata = { ...urlMetadatas[key], params: matched.params };
        }
    }

    if (!urlMetadata) {
        urlMetadata = await fetch(importUrl.href, {
            redirect: "follow",
            headers: {
                "Content-Type": "application/json",
            },
        }).then((res) => res.json());
        let match = urlMetadata?.matchPath?.split(".")?.[0];
        if (!match?.startsWith("/")) match = "/" + match;
        urlMetadata.matchPath = match;
        urlMetadatas[match] = urlMetadata;
    }

    isJSX = urlMetadata?.path?.endsWith(".jsx") || urlMetadata?.path?.endsWith(".tsx");

    const subprocessId = urlMetadata.matchPath;


    if (!subprocesses[subprocessId]) {
        console.log("Spawning subprocess", subprocessId);
        // Adjust the command to your actual worker logic file or command
        const command = new Deno.Command("__requestId__", {
            args: [
                "run",
                "--allow-all", // Be specific with permissions for security
                `./${isJSX ? 'jsx-' : ''}worker.js`,
                // You can pass other necessary arguments here
            ],
            stdin: "piped",
            stdout: "piped",
            stderr: "piped",
        });

        const process = command.spawn();
        subprocesses[subprocessId] = process;
    }

    const promiseResult = new Promise((resolve, reject) => {
        responseHandlers[subprocessId] = { ...responseHandlers?.[subprocessId] };
        responseHandlers[subprocessId][__requestId__] = response;
        resolver[subprocessId] = { ...resolver?.[subprocessId] };
        resolver[subprocessId][__requestId__] = { resolve, reject };
        return resolver[subprocessId][__requestId__]
      });

    const messageData = JSON.stringify({
        __requestId__,
        importUrl: new URL(`${urlMetadata.matchPath}?${importSearchParams}`, importUrl.origin).href,
        currentUrl: currentUrl.href,
        params: { ...pathParams, ...urlMetadata.params, ...queryParams, ...data },
        isJSX,
    });

    // Write the message data to the subprocess
    const writer = subprocesses[subprocessId].stdin.getWriter();
    await writer.write(new TextEncoder().encode(messageData));
    writer.releaseLock();
    await subprocesses[subprocessId].stdin.close();

    // Read the response from the subprocess
    const result = await subprocesses[subprocessId].output();
    const output:any = JSON.parse(new TextDecoder().decode(result));

    if (output?.options) {
        responseHandlers[subprocessId][output.__requestId__].options(
            output.options,
        );
      }
      !output?.__done__ && output?.chunk &&
        responseHandlers[subprocessId][output.__requestId__].stream(
            output.chunk,
        );
      if (output?.__done__) {
        resolver[subprocessId][output.__requestId__].resolve(output.chunk);
        delete responseHandlers[subprocessId][output.__requestId__];
        delete resolver[subprocessId][output.__requestId__];
      }

    // Error handling
    const errorResult = await subprocesses[subprocessId].stderrOutput();
    const errorOutput = new TextDecoder().decode(errorResult);
    if (errorOutput) {
        console.log(errorOutput)
        // resolver[subprocessId][__requestId__].reject(errorOutput);
    } else {
        resolver[subprocessId][__requestId__].resolve(output);
    }

    return await promiseResult;
};
