
const isolatesMetadata = new Map<string, any>();

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
        isolatesMetadata.delete(isolateId);

    }
};

const upgradeIsolate = async (isolateId: string): void => {
    // try to instantiate a new isolate. if it works, set isolateId pointing to the new port and delete/kill the old one. If not, just return
    const oldPort = getPortFromIsolateId(isolateId);
}

export const cleanupIsolates = (): void => {
    console.log("Cleaning up isolates");
    for (const isolateId of isolatesMetadata.keys()) {
        cleanupIsolate(isolateId);
    }
}

export default ({ config, modules }: any) => async (req: Request) => {

    const { permissions } = config;
    const url = new URL(req.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    const importUrl = new URL(modules.path.join(config.loaderUrl, config.functionsDir))
    importUrl.pathname = modules.path.join(importUrl.pathname, url.pathname);
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
                { status: isolateMetadataRes.status, headers: { 'Content-Type': 'application/json' } }
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
                { status: isolateMetadata?.status, headers: { 'Content-Type': 'text/javascript' } }
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
            isolateMetadata.paths = [...isolateMetadata.paths, importUrl.href];
        }

        isolatesMetadata.set(isolateId, isolateMetadata)
    }

    const ext = modules.path.extname(isolateMetadata?.path);
    isJSX = ext === ".jsx" || ext === ".tsx";

    const shouldUpgrade = !isolateMetadata?.loadedAt || (isolateMetadata?.loadedAt <= config?.shouldUpgradeAfter);

    if (!isolateMetadata?.port || shouldUpgrade) {
        try {
            console.log("Spawning isolate id", isolateId);
            const port = await getAvailablePort(3500, 4000);
            const metaUrl = new URL(import.meta.url)?.origin !== "null" ? new URL(import.meta.url)?.origin : null;
            config.debug && console.log('Running with Permissions', permissions)
            const reload = [];

            if (shouldUpgrade) {
                reload.push(...[importUrl.origin, url.origin, metaUrl])
                console.log("Upgrading isolate with ID:", isolateId, 'reloading:', reload.filter(Boolean).join(','));
            }

            const command = new Deno.Command(Deno.execPath(), {
                args: [
                    'run',
                    reload.length ? `--reload=${reload.filter(Boolean).join(',')}` : '',
                    '--deny-run',
                    `--allow-env${permissions?.['allow-env'] === true ? '' : '=' + ['DENO_AUTH_TOKENS', ...(permissions?.['allow-env'] || [])].join(',') || ''}`,
                    `--allow-sys${permissions?.['allow-sys'] === true ? '' : '=' + ['cpus', 'osRelease', ...(permissions?.['allow-sys'] || [])].join(',') || ''}`,
                    `--allow-write${permissions?.['allow-write'] === true ? '' : '=' + ['./cache/', ...(permissions?.['allow-write'] || [])].join(',') || ''}`,
                    '--allow-read',
                    '--allow-net',
                    '--allow-ffi',
                    '--unstable-sloppy-imports',
                    '--unstable-kv',
                    '--unstable',
                    '--no-lock',
                    '--no-prompt',
                    '--importmap=' + `data:application/json,${modules.template(JSON.stringify({ imports: config?.denoConfig?.imports, scope: config?.denoConfig?.scope }), isolateMetadata.variables)}`,
                    new URL(`../isolate/adapters/${isJSX ? 'jsx-' : ''}isolate.ts`, import.meta.url).href,
                    `${port}`,
                    JSON.stringify({
                        importUrl: isolateId,
                        url: url.href,
                        isJSX,
                        env: { ...isolateMetadata.variables },
                        ...config,
                    }),
                    JSON.stringify({
                        DENO_AUTH_TOKENS: isolateMetadata.variables.DENO_AUTH_TOKENS,
                    })
                ].filter(Boolean),
            });
            const process = command.spawn();
            await waitForServer(`http://localhost:${port}`);
            isolateMetadata?.port && cleanupIsolate(isolateId);
            isolatesMetadata.set(isolateId, {
                ...isolateMetadata,
                port,
                pid: process.pid,
                process,
                loadedAt: Date.now(),
            });
        } catch (error) {
            console.error(`Failed to spawn isolate: ${isolateId}`, error);
            throw error;
        }
    }

    try {
        const port = getPortFromIsolateId(isolateId);

        const moduleResponse = await fetch(new URL(
            `${url.pathname}?${new URLSearchParams({ ...queryParams, ...isolateMetadata.params })}`,
            `http://localhost:${port}`
        ), {
            method: req.method,
            headers: req.headers,
            body: req.body
        });

        return moduleResponse;

    } catch (error) {
        console.error("Error communicating with isolate server", error);
        cleanupIsolate(isolateId);
        return new Response(JSON.stringify(error), { status: 500, statusText: 'Bad Request', headers: { 'Content-Type': 'application/json' } });
    }

};
