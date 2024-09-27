import isolateFactory from "./utils/isolateFactory.ts";

const cachedFileUrls = new Map<string, any>();
const isolatesMetadata = new Map<string, any>();

const getIsolate = (isolateId: string) => {
    return isolatesMetadata.get(isolateId);
}

const getCachedFileUrls = () => {
    return Array.from(cachedFileUrls.keys());
}

const setIsolate = (isolateId: string, isolateMetadata: any) => {
    return isolatesMetadata.set(isolateId, isolateMetadata);
}

// Function to kill the isolate
const killIsolate = (isolateId: string) => {
    cleanupIsolate(isolateId);
};

// Function to reset the timer
const resetIsolateTimer = (isolateId: string, timeout: number) => {

    if (getIsolate(isolateId)?.timer) clearTimeout(getIsolate(isolateId)?.timer);

    isolatesMetadata.set(isolateId, {
        ...isolatesMetadata.get(isolateId),
        timer: setTimeout(() => {
            clearTimeout(getIsolate(isolateId)?.timer);
            console.log(`Isolate idle for 5 seconds. Terminating isolate with ID:`, isolateId, getIsolate(isolateId)?.timer);
            killIsolate(isolateId);
        }, timeout)
    })
};

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
    return parseInt(isolatesMetadata.get(isolateId).port);
}

const cleanupIsolate = async (isolateId: string): Promise<void> => {
    const isolateMetadata = getIsolate(isolateId);
    if (isolateMetadata?.status !== 'down') {
        try {
            if (isolateMetadata?.worker) {
                console.log('terminating worker', isolateId);
                isolateMetadata.worker.terminate();
                delete isolateMetadata.worker;
            } else if (isolateMetadata?.pid) {
                console.log('terminating subprocess', isolateId);
                try {
                    Deno.kill(isolateMetadata.pid, 'SIGKILL');
                } catch (killError) {
                    if (!(killError instanceof Deno.errors.NotFound)) {
                        throw killError;
                    }
                    // Process already terminated, log and continue
                    console.log(`Process ${isolateId} already terminated`);
                }
                delete isolateMetadata.pid;
            }
            isolatesMetadata.set(isolateId, { ...isolateMetadata, status: 'down', activeRequests: 0 });
        } catch (err) {
            console.error("Error terminating isolate", err);
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

    if (!config?.isolateType) config.isolateType = config.env.ISOLATE_TYPE || 'subprocess';

    const formatImportUrl = config.formatImportUrl || ((importUrl: URL) => {
        const pathname = importUrl.pathname;
        const ext = modules.path.extname(pathname);
        // remove extension from matchPath
        let matchPath = ext ? pathname?.replace(ext, '') : pathname;
        matchPath = matchPath?.replaceAll(/\[([^\[\]]+)\]/g, ':$1');
        const dirEntrypointIndex = matchPath?.lastIndexOf(`/${config?.dirEntrypoint}`)
        matchPath = dirEntrypointIndex > -1 ? matchPath.slice(0, dirEntrypointIndex) : matchPath;

        const isolateSearchUrl = new URL(importUrl.href)
        isolateSearchUrl.pathname = matchPath;
        return isolateSearchUrl.href;
    });

    const mapFilePathToIsolateId = ((_fileUrl: URL) => {

        const customMapperId = config.mapFilePathToIsolateId ||
            (({ formattedFileUrl, fileUrl }: { fileUrl: string, formattedFileUrl: string }) => {
                const _url = new URL(fileUrl);
                const ext = modules.path.extname(_url.pathname);
                isJSX = ext === '.jsx' || ext === '.tsx';
                return isJSX ? `jsx|tsx` : 'js|ts';
            })

        // Format File Path
        const filePathUrl = new URL(_fileUrl)
        // remove search params from the URL
        filePathUrl.search = '';

        // matchPath is the path to match in the URL
        let ext = filePathUrl.pathname.split('.').pop();
        ext = ext ? `.${ext}` : ext;

        // remove extension from matchPath
        filePathUrl.pathname = ext ? filePathUrl.pathname.replace(ext, '') : filePathUrl.pathname;
        filePathUrl.pathname = filePathUrl.pathname.replaceAll(/\[([^\[\]]+)\]/g, ':$1');

        const dirEntrypointIndex = filePathUrl.pathname?.lastIndexOf(`/${config?.dirEntrypoint}`)
        filePathUrl.pathname = dirEntrypointIndex > -1 ? filePathUrl.pathname.slice(0, dirEntrypointIndex) : filePathUrl.pathname;

        const cachedFileUrl = cachedFileUrls.get(filePathUrl.href)
        if (cachedFileUrl) {
            cachedFileUrls.set(filePathUrl.href, { ...cachedFileUrl, urls: [...new Set([...cachedFileUrl.urls, formattedImportUrl])] });
            return cachedFileUrl.isolateId;
        } else {
            const isolateId = customMapperId({ fileUrl: _fileUrl.href, formattedFileUrl: filePathUrl.href });
            const ext = modules.path.extname(_fileUrl.pathname);
            const isJSX = ext === '.jsx' || ext === '.tsx';
            // update cached file urls
            cachedFileUrls.set(filePathUrl.href, { isolateId, urls: [formattedImportUrl], isJSX });
            return isolateId
        }

    })

    const url = new URL(req.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    const importUrl = new URL(modules.path.join(config.loaderUrl, config.functionsDir))
    importUrl.pathname = modules.path.join(importUrl.pathname, url.pathname).split('/').filter(Boolean).join('/');
    importUrl.search = url.search;

    importUrl.pathname.split('/').filter(Boolean).forEach((part) => {
        if (part.startsWith('_')) { // prevent access to private paths (within files / directories starting with '_')
            return new Response(
                JSON.stringify({ status: 401, message: `Error trying to access private path '${part}' in '${importUrl.href}'.` }),
                { status: 401, headers: { 'Content-Type': 'application/json' } }
            );
        }
    });

    const fileLoaderUrl = importUrl;
    fileLoaderUrl.pathname = '';
    fileLoaderUrl.search = '';

    const publicFile = await getPublicFile(config, importUrl);

    if (publicFile) return publicFile;

    const formattedImportUrl = formatImportUrl(importUrl);

    let isolateMetadata: any = {};
    let isJSX = false;
    let isolateId: string;

    // the more path params the url has, more towards the end of the array it will be
    const matchesParams = (url: string) => url.split('/').filter((part) => part.startsWith(':')).length;
    // get array of possible urls to match
    const sortedFileUrls = getCachedFileUrls()?.sort((a, b) => matchesParams(b) - matchesParams(a));

    let isExactMatch;

    for (const fileUrl of sortedFileUrls) {
        const { pathname, hostname, username } = new URL(fileUrl);
        const pattern = new URLPattern({ username, pathname, hostname })
        config.debug && console.log('matching', username, pathname, hostname, 'with', formattedImportUrl)
        const matched = pattern.exec(formattedImportUrl);
        if (matched) {
            config.debug && console.log('matched', fileUrl, cachedFileUrls.get(fileUrl))
            const importUrls = cachedFileUrls.get(fileUrl)?.urls;
            const matchParams = matched?.pathname?.groups;

            isExactMatch = importUrls?.some((p: string) => p === importUrl.href);
            isolateId = cachedFileUrls.get(fileUrl).isolateId;
            isJSX = cachedFileUrls.get(fileUrl).isJSX;

            isolateMetadata = { ...isolatesMetadata.get(isolateId), params: matchParams };
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

    // append lastLoadedAt for updating the module/component
    const loadedAt = isolateMetadata?.loadedAt
    const searchParams = new URLSearchParams({ ...queryParams, loadedAt }).toString();
    importUrl.search = searchParams

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

        // matchPath is the path to match in the URL
        const matchUrl = new URL(importUrl.href);
        matchUrl.pathname = _isolateMetadata?.matchPath;
        isolateId = mapFilePathToIsolateId(matchUrl);
        const ext = modules.path.extname(matchUrl.pathname);
        isJSX = ext === '.jsx' || ext === '.tsx';

        if (queryParams.bundle) {
            if (isJSX) {
                return new Response(
                    _isolateMetadata?.content,
                    { status: 200, headers: { 'Content-Type': 'text/javascript', 'Access-Control-Allow-Origin': '*' } }
                );
            } else {
                // return not found
                return new Response(
                    JSON.stringify({ error: { message: 'Not Found' } }),
                    { status: 404, headers: { 'Content-Type': 'application/json' } }
                );
            }
        }
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

    const shouldUpgrade = !isolateMetadata?.loadedAt || (isolateMetadata?.loadedAt <= config?.shouldUpgradeAfter);
    if ((!['up', 'loading'].includes(isolateMetadata?.status)) || shouldUpgrade) {
        setIsolate(isolateId, { ...isolateMetadata, status: 'loading' });
        try {
            console.log("Spawning isolate", isolateId);
            const metaUrl = new URL(import.meta.url)?.origin !== "null" ? new URL(import.meta.url) : null;
            metaUrl && (metaUrl.pathname = '');
            metaUrl && (metaUrl.search = '');
            metaUrl && (metaUrl.hash = '');
            let reload;
            const reloadUrl = new URL(formattedImportUrl);
            reloadUrl.pathname = '';


            if (shouldUpgrade) {
                reload = [reloadUrl.href, metaUrl?.href, url.origin]
                config.debug && console.log("Upgrading isolate id", isolateId);
            } else {
                config.debug && console.log("Spawning isolate id", isolateId);
            }

            const port = await getAvailablePort(3500, 4000);

            const projectId = config.projectId || new URL(formattedImportUrl).username
            config.projectId = projectId;
            await modules.fs.ensureDir(`./data/${projectId}`);

            const isolateInstance = await isolateFactory({
                isolateType: config.isolateType,
                isolateId,
                projectId,
                modules,
                port,
                isJSX,
                functionsDir: config.functionsDir,
                denoConfig: config.denoConfig,
                type: config.isolateType,
                reload,
                permissions: config.permissions,
                env: { ...isolateMetadata.variables, ...config.variables, fileLoaderUrl: fileLoaderUrl.href }
            })

            if (config.isolateType === 'worker') {
                isolateInstance.onerror = (error) => {
                    console.error(`Error in isolate ${isolateId}:`, error);
                    cleanupIsolate(isolateId);
                    // You might want to implement logic here to restart the isolate or mark it as failed
                };
            }

            await waitForServer(`http://localhost:${port}/__healthcheck__`);

            isolateMetadata = getIsolate(isolateId);

            if (config.isolateType === 'subprocess') {
                isolateMetadata?.pid && cleanupIsolate(isolateId);
                setIsolate(isolateId, { ...isolateMetadata, port, pid: isolateInstance.pid, instance: isolateInstance, status: 'up', loadedAt: Date.now(), });
            } else {
                isolateMetadata?.worker && cleanupIsolate(isolateId);
                setIsolate(isolateId, { ...isolateMetadata, port, worker: isolateInstance, status: 'up', loadedAt: Date.now() });
            }

        } catch (error) {
            console.error(`Failed to spawn isolate: ${isolateId}`, error);
            return new Response(JSON.stringify({ error: { message: 'Bad Request. Failed to initialize Isolate' } }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        }
    }


    try {
        const port = getPortFromIsolateId(isolateId);

        // Increment active requests counter
        const isolate = getIsolate(isolateId);

        setIsolate(isolateId, { ...isolate, activeRequests: (isolate.activeRequests || 0) + 1 });

        const moduleResponse = await fetch(new URL(
            `${url.pathname}?${new URLSearchParams({
                ...queryParams,
                ...isolateMetadata.params,
                "__importUrl__": btoa(importUrl.href),
                "__isJSX__": isJSX,
                "__proxyUrl__": btoa(url.href),
            })}`,
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
                if (!config.isolateMaxIdleTime) return
                // Decrement active requests counter and reset timer if needed
                const currentIsolate = getIsolate(isolateId);
                const newActiveRequests = Math.max(0, currentIsolate.activeRequests - 1);
                setIsolate(isolateId, { ...currentIsolate, activeRequests: newActiveRequests });
                if (newActiveRequests === 0 && config.isolateMaxIdleTime) {
                    resetIsolateTimer(isolateId, config.isolateMaxIdleTime);  // Reset timer after the last chunk is processed
                }
            },
            async cancel() {
                if (!config.isolateMaxIdleTime) return
                // Decrement active requests counter and reset timer if needed
                const currentIsolate = getIsolate(isolateId);
                const newActiveRequests = Math.max(0, currentIsolate.activeRequests - 1);
                setIsolate(isolateId, { ...currentIsolate, activeRequests: newActiveRequests });
                if (newActiveRequests === 0 && config.isolateMaxIdleTime) {
                    resetIsolateTimer(isolateId, config.isolateMaxIdleTime);  // Reset timer after the last chunk is processed
                }
            },
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

const getPublicFile = async (config: any, importUrl: URL) => {

    if (importUrl.href && config?.publicDir) {
        const publicDirPath = new URL(`/${config.publicDir.split('/').filter(Boolean).join('/')}`, importUrl).pathname;

        if (importUrl.pathname.startsWith(publicDirPath)) {
            const response = await fetch(importUrl);
            return new Response(await response.blob(), {
                status: response.status,
                headers: response.headers
            });
        }
    }

    return null;
}