import runOptions from "./utils/runOptions.ts";
const isolatesMetadata = new Map<string, any>();

// Function to kill the isolate
const killIsolate = (isolateId: string) => {
    cleanupIsolate(isolateId);
};

// Function to reset the timer
const resetIsolateTimer = (isolateId: string) => {
    clearTimeout(isolatesMetadata.get(isolateId)?.timer);

    isolatesMetadata.set(isolateId, {
        ...isolatesMetadata.get(isolateId),
        timer: setTimeout(() => {
            console.log(`Isolate idle for 5 seconds. Terminating isolate with ID:`, isolateId);
            killIsolate(isolateId);
        }, 5000)
    })
};

const getAvailablePort = async (startPort: number, endPort: number): Promise<number> => {
    for (let port = startPort; port <= endPort; port++) {
        try {
            console.log('Checking port:', port);
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
    return parseInt(isolatesMetadata.get(isolateId).port);
}

const cleanupIsolate = async (isolateId: string): void => {
    console.log("Cleaning up isolate with ID:", isolateId);
    if (isolatesMetadata.get(isolateId)) {
        // kill process, delete isolate and its references
        console.log("SIGKILL issued. Terminating isolate with ID:", isolateId);
        Deno.kill(isolatesMetadata.get(isolateId)?.pid, 'SIGKILL');
        isolatesMetadata.set(isolateId, { ...isolatesMetadata.get(isolateId), status: 'down' });

    }
};

export const cleanupIsolates = (): void => {
    console.log("Cleaning up isolates");
    for (const isolateId of isolatesMetadata.keys()) {
        cleanupIsolate(isolateId);
    }
}


export default ({ config, modules }: any) => async (req: Request) => {

    const url = new URL(req.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    const importUrl = new URL(modules.path.join(config.loaderUrl, config.functionsDir))
    importUrl.pathname = modules.path.join(importUrl.pathname, url.pathname).split('/').filter(Boolean).join('/');
    importUrl.search = url.search;

    let isolateMetadata;
    let isJSX = false;
    let isolateId;

    // get array of possible urls to match
    let possibleUrls = Array.from(isolatesMetadata.keys());
    // the more path params the url has, more towards the end of the array it will be
    const matchesParams = (url: string) => url.split('/').filter((part) => part.startsWith(':')).length;
    possibleUrls = possibleUrls?.sort((a, b) => {
        return matchesParams(b) - matchesParams(a);
    })

    let isExactMatch;
    for (const key of possibleUrls) {
        const { pathname, hostname } = new URL(key);
        const pattern = new URLPattern({ pathname, hostname })
        const matched = pattern.exec(importUrl.href);
        if (matched) {
            const keyPaths = isolatesMetadata.get(key)?.paths;
            const matchParams = matched?.pathname?.groups;

            isExactMatch = keyPaths?.some((p: string) => p === importUrl.href)
            isolateId = key;

            isolateMetadata = { ...isolatesMetadata.get(key), params: matchParams };
        }
    }

    if (isolateMetadata?.status === 'loading') {
        const status = isolatesMetadata.get(isolateId)?.status;
        while (status === 'loading') {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        isolateMetadata = isolatesMetadata.get(isolateId);
    };


    if (!isolateMetadata || queryParams.bundle || !isExactMatch) {

        const isolateMetadataRes = await fetch(importUrl.href, {
            redirect: "follow",
            headers: { "content-type": "application/json" },
            method: "POST",
            body: JSON.stringify({ denoConfig: config?.denoConfig })
        });

        if (!isolateMetadataRes.ok) {
            return new Response(
                JSON.stringify({ error: { message: isolateMetadataRes.statusText } }),
                { status: isolateMetadataRes.status || 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        let _isolateMetadata

        try {
            _isolateMetadata = await isolateMetadataRes.json();
        } catch (err) {
            console.log('Error importing metadata', importUrl.href, isolateMetadata)
            return new Response(
                JSON.stringify({ error: { message: 'Bad Request' } }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        if (queryParams.bundle) {
            return new Response(
                _isolateMetadata?.content,
                { status: 200, headers: { 'Content-Type': 'text/javascript' } }
            );
        }

        // matchPath is the path to match in the URL
        const matchExt = modules.path.extname(_isolateMetadata?.matchPath);
        let match = matchExt ? _isolateMetadata?.matchPath?.replace(matchExt, '') : _isolateMetadata?.matchPath;
        if (match) match = match?.startsWith('/') ? match : `/${match}`;
        match = match?.replaceAll(/\[([^\[\]]+)\]/g, ':$1');
        const dirEntrypointIndex = match?.lastIndexOf(`/${config?.dirEntrypoint}`)
        match = dirEntrypointIndex > -1 ? match.slice(0, dirEntrypointIndex) : match;
        _isolateMetadata.matchPath = match;
        // isolateId is the URL to match in the URL
        isolateId = new URL(importUrl.href)
        isolateId.pathname = match;
        isolateId = isolateId.href;

        // isolateMetadata is the metadata for the isolate
        if (!isolatesMetadata.get(isolateId)) {
            isolateMetadata = _isolateMetadata;
            isolateMetadata.paths = [importUrl.href];
        } else {
            isolateMetadata.paths = [...isolatesMetadata.get(isolateId)?.paths, importUrl.href];
        }

        isolatesMetadata.set(isolateId, isolateMetadata)
    }

    clearTimeout(isolatesMetadata.get(isolateId)?.timer);

    const ext = modules.path.extname(isolateMetadata?.path);
    isJSX = ext === ".jsx" || ext === ".tsx";

    const shouldUpgrade = !isolateMetadata?.loadedAt || (isolateMetadata?.loadedAt <= config?.shouldUpgradeAfter);
    if ((['up', 'loading'].indexOf(isolateMetadata?.status) === -1) || shouldUpgrade) {
        isolatesMetadata.set(isolateId, { ...isolateMetadata, status: 'loading' });
        try {

            const { origin: reloadUrlOrigin, username: reloadUrlUsername } = new URL(isolateId);
            const reloadUrl = new URL(reloadUrlOrigin);
            reloadUrl.username = reloadUrlUsername;

            const metaUrl = new URL(import.meta.url)?.origin !== "null" ? new URL(import.meta.url)?.origin : null;
            let reload;

            if (shouldUpgrade) {
                reload = [new URL(isolateId).origin, metaUrl, url.origin, reloadUrl.href]
                console.log("Upgrading isolate id", isolateId);
            } else {
                console.log("Spawning isolate id", isolateId);
            }

            const port = await getAvailablePort(3500, 4000);
            const projectId = new URL(isolateId).username;
            config.projectId = projectId;

            await modules.fs.ensureDir(`./data/${projectId}`);
            const command = new Deno.Command(Deno.execPath(), {
                env: { DENO_DIR: config.cacheDir || `./cache/.deno`, },
                cwd: `./data/${projectId}`,
                args: [
                    'run',
                    ...runOptions({ reload, ...config.permissions }, { config, modules, variables: isolateMetadata.variables }),
                    new URL(`../isolate/adapters/${isJSX ? 'jsx-' : ''}isolate.ts`, import.meta.url).href, // path to isolate.ts
                    `${port}`, // port
                    JSON.stringify({
                        projectId,
                        importUrl: isolateId,
                        url: url.href,
                        isJSX,
                        env: { ...isolateMetadata.variables },
                        ...config,
                    }), // isolate metadata
                ].filter(Boolean),
            });
            const process = command.spawn();
            await waitForServer(`http://localhost:${port}/__healthcheck__`);
            isolateMetadata.status && isolateMetadata.status !== 'down' && cleanupIsolate(isolateId);
            isolatesMetadata.set(isolateId, {
                ...isolateMetadata,
                port,
                pid: process.pid,
                process,
                status: 'up',
                loadedAt: Date.now(),
            });
        } catch (error) {
            console.error(`Failed to spawn isolate: ${isolateId}`, error);
            return new Response(JSON.stringify({ error: { message: 'Bad Request. Failed to initialize Isolate' } }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }

    try {
        const port = getPortFromIsolateId(isolateId);

        const moduleResponse = await fetch(new URL(
            `${url.pathname}?${new URLSearchParams({ ...queryParams, ...isolateMetadata.params })}`,
            `http://localhost:${port}`
        ), {
            method: req.method,
            redirect: "manual",
            headers: req.headers,
            body: req.body
        });

        // Using pipeThrough to process the stream and kill the isolate after the last chunk is sent
        const transformStream = new TransformStream({
            start() { },
            transform(chunk, controller) {
                controller.enqueue(chunk);
            },
            flush(controller) {
                controller.terminate();
                resetIsolateTimer(isolateId);  // Reset timer after the last chunk is processed
            }
        });

        const responseStream = moduleResponse.body?.pipeThrough(transformStream);

        return new Response(responseStream, {
            headers: moduleResponse.headers,
            status: moduleResponse.status,
            statusText: moduleResponse.statusText,
        });

    } catch (error) {
        console.error("Error communicating with isolate server", error);
        cleanupIsolate(isolateId);
        return new Response(JSON.stringify(error), { status: 500, statusText: 'Bad Request', headers: { 'Content-Type': 'application/json' } });
    }

};
