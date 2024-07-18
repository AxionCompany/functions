

const isolates: Map<string, any> = new Map();
const urlMetadatas: Map<string, any> = new Map();

const getAvailablePort = async (startPort: number, endPort: number): Promise<number> => {
    for (let port = startPort; port <= endPort; port++) {
        try {
            const listener = Deno.listen({ port });
            listener.close();
            return port;
        } catch (error) {
            if (error instanceof Deno.errors.AddrInUse) {
                continue;
            }
            throw error;
        }
    }
    throw new Error("No available ports found.");
};

const waitForServer = async (url: string, timeout: number = 1000 * 60): Promise<void> => {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        try {
            await fetch(url);
            return;
        } catch (error) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }
    throw new Error(`Timed out waiting for server: ${url}`);
};

const getPortFromIsolateId = (isolateId: string): number => {
    return parseInt(isolates.get(isolateId).port);
}

const cleanupIsolate = async (isolateId: string): void => {
    if (isolates.get(isolateId)) {
        // kill process
        console.log("SIGTERM issued. Terminating isolate with ID:", isolateId);
        Deno.kill(isolates.get(isolateId)?.pid, 'SIGTERM');
        // delete isolate and its references
        isolates.delete(isolateId);
        urlMetadatas.delete(isolateId);

    }
};

export const cleanupIsolates = (): void => {
    for (const isolateId of isolates.keys()) {
        cleanupIsolate(isolateId);
    }
}

export default ({ config, modules }: any) => async (
    { url, pathname, headers, subdomain, method, data, ctx, params, queryParams, __requestId__ }: {
        url: URL;
        method: string;
        headers: any;
        subdomain: string;
        pathname: string;
        ctx: any | null;
        params: any | null;
        data: any | null;
        queryParams: any | null;
        __requestId__: string;
    }, response: any) => {

    const importUrl = !queryParams?.customBaseUrl ? new URL(modules.path.join(config.loaderUrl, config.functionsDir)) : new URL(config.loaderUrl);
    importUrl.pathname = modules.path.join(importUrl.pathname, pathname);
    importUrl.search = url.search;
    importUrl.username = url.username;
    importUrl.password = url.password;

    const importSearchParams = new URL(importUrl).searchParams.toString();

    let urlMetadata;
    let isJSX = false;
    let isolateId;


    for (const key of urlMetadatas.keys()) {
        const { pathname, hostname } = new URL(key);
        const pattern = new URLPattern({ pathname, hostname })
        const matched = pattern.exec(importUrl.href);
        if (matched) {
            isolateId = key;
            urlMetadata = { ...urlMetadatas.get(key), params: matched.pathname.groups };
        }
    }

    if (!urlMetadata || queryParams.bundle) {
        urlMetadata = await fetch(importUrl.href, {
            redirect: "follow",
            headers: {
                "content-type": "application/json",
            },
            method: "POST",
            body: JSON.stringify({ denoConfig: config?.denoConfig })
        });

        if (!urlMetadata.ok) {
            response.status(urlMetadata.status)
            response.statusText(urlMetadata.statusText)
            return { error: urlMetadata.statusText }
        }
        urlMetadata = await urlMetadata.json();

        if (queryParams.bundle) {
            response.headers({ "content-type": "text/javascript" });
            if (!urlMetadata?.content) {
                response.status(404)
                response.statusText("Module not found")
            }
            return urlMetadata?.content;
        }

        const matchExt = modules.path.extname(urlMetadata?.matchPath);
        let match = matchExt ? urlMetadata?.matchPath?.replace(matchExt, '') : urlMetadata?.matchPath;
        if (match) match = match?.startsWith('/') ? match : `/${match}`;
        match = match?.replaceAll(/\[([^\[\]]+)\]/g, ':$1');
        const dirEntrypointIndex = match?.lastIndexOf(`/${config?.dirEntrypoint}`)
        match = dirEntrypointIndex > -1 ? match.slice(0, dirEntrypointIndex) : match;
        isolateId = new URL(match, url.origin).href
        urlMetadata.matchPath = match;
        urlMetadatas.set(isolateId, urlMetadata);
    }

    const ext = modules.path.extname(urlMetadata?.path);
    isJSX = ext === ".jsx" || ext === ".tsx";


    if (!isolates.get(isolateId)) {
        try {
            console.log("Spawning isolate", isolateId);
            const port = await getAvailablePort(3500, 4000);
            const metaUrl = new URL(import.meta.url)?.origin !== "null" ? new URL(import.meta.url)?.origin : null
            console.log('importMap', JSON.stringify({ imports: config?.denoConfig?.imports, scope: config?.denoConfig?.scope }));
            const command = new Deno.Command(Deno.execPath(), {
                args: [
                    'run',
                    `--reload=${[importUrl.origin, url.origin, metaUrl].filter(Boolean).join(',')}`,
                    '--allow-env=DENO_AUTH_TOKENS',
                    '--deny-run',
                    '--allow-net',
                    '--allow-sys=cpus,osRelease',
                    '--allow-read',
                    '--allow-write=./cache/',
                    '--unstable-sloppy-imports',
                    '--unstable-kv',
                    '--unstable',
                    '--no-lock',
                    '--no-prompt',
                    '--importmap=' + `data:application/json,${JSON.stringify({ imports: config?.denoConfig?.imports, scope: config?.denoConfig?.scope })}`,
                    new URL(`./adapters/${isJSX ? 'jsx-' : ''}isolate.ts`, import.meta.url).href,
                    `${port}`,
                    JSON.stringify({
                        __requestId__: __requestId__,
                        importUrl: new URL(`${urlMetadata.matchPath}?${importSearchParams}`, importUrl.origin).href,
                        currentUrl: url.href,
                        isJSX,
                        headers,
                        env: { ...urlMetadata.variables },
                        ...config,
                    }),
                    JSON.stringify({
                        DENO_AUTH_TOKENS: urlMetadata.variables.DENO_AUTH_TOKENS,
                    })
                ],
            });
            const process = command.spawn();
            isolates.set(isolateId, {
                port,
                pid: process.pid,
                process,
            });
            await waitForServer(`http://localhost:${port}`);
        } catch (error) {
            console.error(`Failed to spawn isolate: ${isolateId}`, error);
            throw error;
        }
    }

    try {
        const port = getPortFromIsolateId(isolateId);

        const moduleResponse = await fetch(`http://localhost:${port}`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                headers,
                env: { ...urlMetadata.variables },
                params: {
                    ...params,
                    ...ctx,
                    ...urlMetadata.params,
                    ...queryParams,
                    ...data,
                },
                method,
                __requestId__: __requestId__,
                currentUrl: url.href,
            }),
        });

        response.headers(Object.fromEntries(moduleResponse.headers.entries()));
        response.status(moduleResponse.status);
        response.statusText(moduleResponse.statusText);

        if (!moduleResponse.ok) {
            const errorResponse = await moduleResponse.text();
            try {
                const errorMessage = JSON.parse(errorResponse);
                return errorMessage;
            } catch (_) {
                return errorResponse;
            }
        }

        let resolver: any;

        const resolved = new Promise((resolve, reject) => {
            resolver = { resolve, reject };
        });

        // create a reader to read the stream
        const reader = moduleResponse?.body?.getReader();

        reader?.read()?.then(function processText({ done, value }): any {

            // value for fetch streams is a Uint8Array
            const chunk = new TextDecoder('utf-8').decode(value);

            // stream the chunk to the response
            response.stream(chunk);

            // if it's done, then stop reading
            if (done) {
                return resolver.resolve(chunk);
            }

            // Read some more, and call this function again
            return reader.read().then(processText);
        });
        await resolved;

        return;

    } catch (error) {
        console.error("Error communicating with isolate server", error);
        cleanupIsolate(isolateId);
        throw error;
    }

};
