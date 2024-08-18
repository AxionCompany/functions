import runOptions from "./utils/runOptions.ts";

const isolatesMetadata = new Map<string, any>();

const getIsolate = (isolateId: string) => {
    return isolatesMetadata.get(isolateId);
}
const getIsolateKeys = () => {
    return Array.from(isolatesMetadata.keys());
}
const setIsolate = (isolateId: string, isolateMetadata: any) => {
    return isolatesMetadata.set(isolateId, isolateMetadata);
}

// Function to kill the isolate
const killIsolate = (isolateId: string) => {
    cleanupIsolate(isolateId);
};

// Function to reset the timer
const resetIsolateTimer = (isolateId: string, timeout:number) => {

    if (getIsolate(isolateId)?.timer) clearTimeout(getIsolate(isolateId)?.timer);

    isolatesMetadata.set(isolateId, {
        ...isolatesMetadata.get(isolateId),
        timer: setTimeout(() => {
            clearTimeout(getIsolate(isolateId)?.timer);
            console.log(`Isolate idle for 5 seconds. Terminating isolate with ID:`, isolateId, getIsolate(isolateId)?.timer);
            killIsolate(isolateId);
        }, timeout || 5*60*1000)
    })
};

const getAvailablePort = async (startPort: number, endPort: number): Promise<number> => {
    for (let port = startPort; port <= endPort; port++) {
        try {
            // console.log('Checking port:', port);
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
    // console.log("Cleaning up isolate with ID:", isolateId);
    const isolateMetadata = getIsolate(isolateId);
    if (isolateMetadata && isolateMetadata.status && isolateMetadata.status !== 'down') {
        // kill process, delete isolate and its references
        try {
            // console.log("SIGKILL issued. Terminating isolate with ID:", isolateId);
            isolatesMetadata.set(isolateId, { ...isolatesMetadata.get(isolateId), status: 'down' });
            Deno.kill(isolatesMetadata.get(isolateId)?.pid, 'SIGKILL');
        } catch (err) {
            // console.error("Error terminating isolate", err);
        }
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

    const setIsolateSearchUrl = config.setIsolateSearchUrl ||
        ((importUrl: URL) => {
            const pathname = importUrl.pathname;
            const ext = modules.path.extname(pathname);
            // remove extension from matchPath
            let matchPath = ext ? pathname?.replace(ext, '') : pathname
            const dirEntrypointIndex = matchPath?.lastIndexOf(`/${config?.dirEntrypoint}`)
            matchPath = dirEntrypointIndex > -1 ? matchPath.slice(0, dirEntrypointIndex) : matchPath;

            const isolateSearchUrl = new URL(importUrl.href)
            isolateSearchUrl.pathname = matchPath;
            return isolateSearchUrl.href;
        })

    const setIsolateUrlPattern = config.setIsolateUrlPattern ||
        ((matchUrl: URL) => {
            // matchPath is the path to match in the URL
            const pathname = matchUrl.pathname;
            const ext = modules.path.extname(pathname);
            // remove extension from matchPath
            let matchPath = ext ? pathname?.replace(ext, '') : pathname
            matchPath = matchPath?.replaceAll(/\[([^\[\]]+)\]/g, ':$1');
            const dirEntrypointIndex = matchPath?.lastIndexOf(`/${config?.dirEntrypoint}`)
            matchPath = dirEntrypointIndex > -1 ? matchPath.slice(0, dirEntrypointIndex) : matchPath;
            // isolateId is the URL to match in the URL
            const isolateUrlPattern = new URL(matchUrl.href)
            isolateUrlPattern.pathname = matchPath;
            return isolateUrlPattern.href;
        })

    let isolateMetadata: any = {};
    let isJSX = false;
    let isolateId: string;

    // the more path params the url has, more towards the end of the array it will be
    const matchesParams = (url: string) => url.split('/').filter((part) => part.startsWith(':')).length;
    // get array of possible urls to match
    const isolateIdPatterns = getIsolateKeys()?.sort((a, b) => {
        return matchesParams(b) - matchesParams(a);
    })

    let isExactMatch;

    for (const key of isolateIdPatterns) {
        const { pathname, hostname, username } = new URL(key);
        const pattern = new URLPattern({ username, pathname, hostname })
        const isolateSearchUrl = setIsolateSearchUrl(importUrl);
        config.debug && console.log('matching', username, pathname, hostname, 'with', isolateSearchUrl)
        const matched = pattern.exec(isolateSearchUrl);
        if (matched) {
            config.debug && console.log('matched', matched)
            const keyPaths = isolatesMetadata.get(key)?.paths;
            const matchParams = matched?.pathname?.groups;

            isExactMatch = keyPaths?.some((p: string) => p === importUrl.href)
            isolateId = key;

            isolateMetadata = { ...getIsolate(key), params: matchParams };
            break;
        }
    }

    if (isolateId && isolateMetadata?.status === 'loading') {
        config.debug && console.log('Isolate is loading. Waiting for it to finish', isolateId);
        const status = getIsolate(isolateId)?.status;
        while (status === 'loading') {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        config.debug && console.log('Isolate has finished loading', isolateId);
        isolateMetadata = getIsolate(isolateId);
    };


    if (!isolateMetadata || queryParams.bundle || !isExactMatch) {
        config.debug && console.log('Isolate not found. Importing metadata', importUrl.href);

        const isolateMetadataRes = await fetch(importUrl.href, {
            redirect: "follow",
            headers: { "content-type": "application/json" },
            method: "POST",
            body: JSON.stringify({ denoConfig: config?.denoConfig })
        });

        if (!isolateMetadataRes.ok) {
            config.debug && console.log('Error importing metadata', importUrl.href, isolateMetadataRes.statusText)
            return new Response(
                JSON.stringify({ error: { message: isolateMetadataRes.statusText } }),
                { status: isolateMetadataRes.status || 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        let _isolateMetadata

        try {
            _isolateMetadata = await isolateMetadataRes.json();
        } catch (err) {
            config.debug && console.log('Error importing metadata', importUrl.href, isolateMetadata)
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
        const matchUrl = new URL(importUrl.href);
        matchUrl.pathname = _isolateMetadata?.matchPath;
        isolateId = setIsolateUrlPattern(matchUrl);

        // get updated state of isolate metadata
        isolateMetadata = getIsolate(isolateId) || {};
        // merge paths
        const paths = [...(isolateMetadata?.paths || []), _isolateMetadata.path];
        Object.assign(isolateMetadata, { ..._isolateMetadata, paths });

        // set isolate metadata
        config.debug && console.log('Setting isolate metadata', isolateId)
        setIsolate(isolateId, isolateMetadata);

    }

    clearTimeout(getIsolate(isolateId)?.timer);

    const ext = modules.path.extname(isolateMetadata?.path);
    isJSX = ext === ".jsx" || ext === ".tsx";

    const shouldUpgrade = !isolateMetadata?.loadedAt || (isolateMetadata?.loadedAt <= config?.shouldUpgradeAfter);
    if ((['up', 'loading'].indexOf(isolateMetadata?.status) === -1) || shouldUpgrade) {
        setIsolate(isolateId, { ...isolateMetadata, status: 'loading' });
        try {

            const { origin: reloadUrlOrigin, username: reloadUrlUsername } = new URL(isolateId);
            const reloadUrl = new URL(reloadUrlOrigin);
            reloadUrl.username = reloadUrlUsername;

            const metaUrl = new URL(import.meta.url)?.origin !== "null" ? new URL(import.meta.url)?.origin : null;
            let reload;

            if (shouldUpgrade) {
                reload = [new URL(isolateId).origin, metaUrl, url.origin, reloadUrl.href]
                config.debug && console.log("Upgrading isolate id", isolateId);
            } else {
                config.debug && console.log("Spawning isolate id", isolateId);
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
                        isolateId,
                        projectId,
                        isJSX,
                        env: { ...isolateMetadata.variables },
                        ...config,
                    }), // isolate metadata
                ].filter(Boolean),
            });
            const process = command.spawn();
            await waitForServer(`http://localhost:${port}/__healthcheck__`);
            isolateMetadata = getIsolate(isolateId);
            isolateMetadata?.pid && cleanupIsolate(isolateId);
            setIsolate(isolateId, { ...isolateMetadata, port, pid: process.pid, process, status: 'up', loadedAt: Date.now() });
        } catch (error) {
            console.error(`Failed to spawn isolate: ${isolateId}`, error);
            return new Response(JSON.stringify({ error: { message: 'Bad Request. Failed to initialize Isolate' } }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }

    try {
        const port = getPortFromIsolateId(isolateId);

        const moduleResponse = await fetch(new URL(
            `${url.pathname}?${new URLSearchParams({ ...queryParams, ...isolateMetadata.params, "__importUrl__": btoa(importUrl.href) })}`,
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
                if (!getIsolate(isolateId)?.timer) resetIsolateTimer(isolateId, config.isolateMaxIdleTime);  // Reset timer after the last chunk is processed
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
