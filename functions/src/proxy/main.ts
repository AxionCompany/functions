import isolateFactory, { IsolateFactoryConfig, IsolateInstance } from "./utils/isolateFactory.ts";
import { PermissionsConfig } from "./utils/runOptions.ts";
import { logDebugWithConfig, logError, logInfo, logWarning, setLogConfig, LogConfig } from "../utils/logger.ts";

// ===== Type Definitions =====
/**
 * Metadata for an isolate instance
 */
interface IsolateMetadata {
    /** Current status of the isolate */
    status: 'up' | 'down' | 'loading';
    /** Port the isolate is running on */
    port?: number;
    /** Process ID for subprocess isolates */
    pid?: number;
    /** Worker reference for worker isolates */
    worker?: Worker;
    /** Isolate instance reference */
    instance?: IsolateInstance;
    /** Timer ID for cleanup timeout */
    timer?: number;
    /** Number of active requests being processed */
    activeRequests: number;
    /** Timestamp when the isolate was loaded */
    loadedAt?: number;
    /** File paths associated with this isolate */
    paths?: string[];
    /** URL parameters for this isolate */
    params?: Record<string, any>;
    /** Environment variables for this isolate */
    variables?: Record<string, any>;
    /** Any additional properties */
    [key: string]: any;
}

/**
 * Configuration for the proxy
 */
export interface ProxyConfig {
    /** URL for the file loader */
    loaderUrl: string;
    /** Directory entrypoint file name */
    dirEntrypoint?: string;
    /** Timestamp when code should be upgraded */
    shouldUpgradeAfter?: number;
    /** Functions directory path */
    functionsDir?: string;
    /** Deno configuration */
    denoConfig?: {
        imports?: Record<string, string>;
        scopes?: Record<string, Record<string, string>>;
        [key: string]: any;
    };
    /** Debug logging flag */
    debugLogs?: boolean;
    /** Error logging flag */
    errorLogs?: boolean;
    /** Info logging flag */
    infoLogs?: boolean;
    /** Warning logging flag */
    warningLogs?: boolean;
    /** Isolate type (worker or subprocess) */
    isolateType?: 'worker' | 'subprocess';
    /** Maximum idle time for isolates in milliseconds */
    isolateMaxIdleTime?: number;
    /** Function to map file paths to isolate IDs */
    mapFilePathToIsolateId?: ((params: { formattedFileUrl: string, fileUrl?: string }) => string) | null;
    /** Permissions configuration */
    permissions?: Partial<PermissionsConfig>;
    /** Any additional properties */
    [key: string]: any;
}

/**
 * Modules provided to the proxy
 */
export interface ProxyModules {
    /** Path utilities */
    path: {
        SEPARATOR: string;
        basename: (path: string, ext?: string) => string;
        extname: (path: string) => string;
        join: (...paths: string[]) => string;
        dirname: (path: string) => string;
    };
    /** Template rendering function */
    template: (template: string, variables: Record<string, string>) => string;
    /** File system utilities */
    fs: {
        ensureDir: (dir: string) => Promise<void>;
    };
    /** Any additional modules */
    [key: string]: any;
}

/**
 * Proxy handler parameters
 */
export interface ProxyParams {
    /** Configuration for the proxy */
    config: ProxyConfig;
    /** Modules available to the proxy */
    modules: ProxyModules;
}

// Global config for logging
let globalConfig: LogConfig = { debugLogs: false, errorLogs: true, infoLogs: false, warningLogs: false };

// ===== State Management =====
class IsolateManager {
    private isolates = new Map<string, IsolateMetadata>();
    private cachedUrls = new Map<string, any>();
    private portAllocationMutex = Promise.resolve();

    // Get isolate metadata
    getIsolate(isolateId: string | undefined): IsolateMetadata | undefined {
        if (!isolateId) {
            logError("Attempted to get isolate with undefined ID");
            return undefined;
        }
        const isolate = this.isolates.get(isolateId);
        logDebugWithConfig(globalConfig, `Getting isolate ${isolateId}: ${isolate ? isolate.status : 'not found'}`);
        return isolate;
    }

    // Set isolate metadata
    setIsolate(isolateId: string | undefined, metadata: IsolateMetadata): void {
        if (!isolateId) {
            logError("Attempted to set isolate with undefined ID");
            return;
        }
        logDebugWithConfig(globalConfig, `Setting isolate ${isolateId} with status: ${metadata.status}`);
        this.isolates.set(isolateId, metadata);
    }

    // Update isolate metadata
    updateIsolate(isolateId: string | undefined, updates: Partial<IsolateMetadata>): void {
        if (!isolateId) {
            logError("Attempted to update isolate with undefined ID");
            return;
        }
        const current = this.getIsolate(isolateId);
        if (current) {
            logDebugWithConfig(globalConfig, `Updating isolate ${isolateId} from ${current.status} with: ${JSON.stringify(updates)}`);
            this.setIsolate(isolateId, { ...current, ...updates });
        } else {
            logError(`Cannot update non-existent isolate: ${isolateId}`);
        }
    }

    // Get all cached file URLs
    getCachedFileUrls(): string[] {
        const urls = Array.from(this.cachedUrls.keys());
        logDebugWithConfig(globalConfig, `Getting cached file URLs: ${urls.length} found`);
        return urls;
    }

    // Set cached file URL
    setCachedFileUrl(url: string, data: any): void {
        logDebugWithConfig(globalConfig, `Setting cached file URL: ${url}`);
        this.cachedUrls.set(url, data);
    }

    // Get cached file URL data
    getCachedFileUrl(url: string): any {
        const data = this.cachedUrls.get(url);
        logDebugWithConfig(globalConfig, `Getting cached file URL ${url}: ${data ? 'found' : 'not found'}`);
        return data;
    }

    // Kill an isolate
    async killIsolate(isolateId: string | undefined): Promise<void> {
        if (!isolateId) {
            logError("Attempted to kill isolate with undefined ID");
            return;
        }
        logInfo(`Killing isolate: ${isolateId}`);
        await this.cleanupIsolate(isolateId);
    }

    // Reset isolate timer
    resetIsolateTimer(isolateId: string | undefined, timeout: number): void {
        if (!isolateId) {
            logError("Attempted to reset timer for isolate with undefined ID");
            return;
        }

        const isolate = this.getIsolate(isolateId);
        if (!isolate) {
            logError(`Cannot reset timer for non-existent isolate: ${isolateId}`);
            return;
        }

        // Clear existing timer if any
        if (isolate.timer) {
            logDebugWithConfig(globalConfig, `Clearing existing timer for isolate ${isolateId}`);
            clearTimeout(isolate.timer);
        }

        // Set new timer
        logDebugWithConfig(globalConfig, `Setting new timer for isolate ${isolateId} with timeout ${timeout}ms`);
        const timerId = setTimeout(() => {
            logInfo(`Isolate idle for ${timeout}ms. Terminating isolate with ID: ${isolateId}`);
            this.killIsolate(isolateId);
        }, timeout);

        this.updateIsolate(isolateId, { timer: timerId as unknown as number });
    }

    // Cleanup all isolates
    cleanupAllIsolates(): void {
        logInfo("Cleaning up all isolates");
        for (const isolateId of this.isolates.keys()) {
            this.cleanupIsolate(isolateId);
        }
    }

    // Cleanup a specific isolate
    async cleanupIsolate(isolateId: string | undefined): Promise<void> {
        if (!isolateId) {
            logError("Attempted to cleanup isolate with undefined ID");
            return;
        }

        const isolate = this.getIsolate(isolateId);
        if (!isolate || isolate.status === 'down') {
            logDebugWithConfig(globalConfig, `Isolate ${isolateId} is already down or doesn't exist`);
            return;
        }

        try {
            if (isolate.worker) {
                logInfo(`Terminating worker isolate: ${isolateId}`);
                isolate.worker.terminate();
                delete isolate.worker;
            } else if (isolate.pid) {
                logInfo(`Terminating subprocess isolate: ${isolateId}`);
                try {
                    Deno.kill(isolate.pid, 'SIGKILL');
                } catch (killError) {
                    if (!(killError instanceof Deno.errors.NotFound)) {
                        throw killError;
                    }
                    logInfo(`Process ${isolateId} already terminated`);
                }
                delete isolate.pid;
            }

            this.updateIsolate(isolateId, {
                status: 'down',
                activeRequests: 0
            });
        } catch (err) {
            logError(`Error terminating isolate ${isolateId}:`, err);
        }
    }

    // Get port from isolate ID
    getPortFromIsolateId(isolateId: string | undefined): number {
        if (!isolateId) {
            logError("Attempted to get port for isolate with undefined ID");
            throw new Error(`No isolate ID provided`);
        }

        const isolate = this.getIsolate(isolateId);
        if (!isolate || !isolate.port) {
            logError(`No port found for isolate ${isolateId}`);
            throw new Error(`No port found for isolate ${isolateId}`);
        }

        logDebugWithConfig(globalConfig, `Getting port for isolate ${isolateId}: ${isolate.port}`);
        return isolate.port;
    }

    // Safely get an available port with mutex protection
    async getAvailablePort(startPort: number, endPort: number): Promise<number> {
        logDebugWithConfig(globalConfig, `Requesting available port in range ${startPort}-${endPort}`);

        // Create a release function with a default implementation
        let releaseMutex = () => {
            logDebugWithConfig(globalConfig, `Default release function called`);
        };

        // Wait for any ongoing port allocation to complete
        await this.portAllocationMutex;

        // Create a new promise that will be resolved when this allocation completes
        const mutexPromise = new Promise<void>(resolve => {
            // Update the release function to resolve the promise
            releaseMutex = () => {
                logDebugWithConfig(globalConfig, `Releasing port allocation mutex`);
                resolve();
            };
        });

        // Update the mutex to point to this new promise
        this.portAllocationMutex = mutexPromise;

        try {
            // Find an available port
            for (let port = startPort; port <= endPort; port++) {
                try {
                    logDebugWithConfig(globalConfig, `Trying port ${port}`);
            const listener = Deno.listen({ port });
            listener.close();
                    logInfo(`Found available port: ${port}`);
            return port;
        } catch (error) {
            if (error instanceof Deno.errors.AddrInUse) {
                        logDebugWithConfig(globalConfig, `Port ${port} is in use, trying next`);
                continue;
                    }
                    logError(`Error checking port ${port}:`, error);
                    throw error;
                }
            }
            logError(`No available ports found in range ${startPort}-${endPort}`);
            throw new Error("No available ports found.");
        } finally {
            // Release the mutex
            releaseMutex();
        }
    }

    // Increment active requests counter
    incrementActiveRequests(isolateId: string | undefined): void {
        if (!isolateId) {
            logError("Attempted to increment requests for isolate with undefined ID");
            return;
        }

        const isolate = this.getIsolate(isolateId);
        if (isolate) {
            const newCount = (isolate.activeRequests || 0) + 1;
            logDebugWithConfig(globalConfig, `Incrementing active requests for isolate ${isolateId} to ${newCount}`);
            this.updateIsolate(isolateId, {
                activeRequests: newCount
            });
        } else {
            logError(`Cannot increment requests for non-existent isolate: ${isolateId}`);
        }
    }

    // Decrement active requests counter
    decrementActiveRequests(isolateId: string | undefined, config: any): void {
        if (!isolateId) {
            logError("Attempted to decrement requests for isolate with undefined ID");
            return;
        }

        const isolate = this.getIsolate(isolateId);
        if (!isolate) {
            logError(`Cannot decrement requests for non-existent isolate: ${isolateId}`);
            return;
        }

        const newActiveRequests = Math.max(0, (isolate.activeRequests || 0) - 1);
        logDebugWithConfig(config, `Decrementing active requests for isolate ${isolateId} to ${newActiveRequests}`);
        this.updateIsolate(isolateId, { activeRequests: newActiveRequests });

        // Reset timer if no active requests and idle timeout is configured
        if (newActiveRequests === 0 && config.isolateMaxIdleTime) {
            logDebugWithConfig(config, `No active requests, setting idle timer for isolate ${isolateId}`);
            this.resetIsolateTimer(isolateId, config.isolateMaxIdleTime);
        }
    }
}

// ===== Utility Functions =====
async function waitForServer(url: string, timeout: number = 1000 * 60): Promise<void> {
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
}

// ===== Main Handler =====
export const cleanupIsolates = (): void => {
    isolateManager.cleanupAllIsolates();
};

// Create a singleton instance of IsolateManager
const isolateManager = new IsolateManager();

export default ({ config, modules }: ProxyParams) => async (req: Request): Promise<Response> => {
    // Update global config for logging
    globalConfig = {
        debugLogs: config.debugLogs,
        errorLogs: config.errorLogs !== false,
        infoLogs: config.infoLogs,
        warningLogs: config.warningLogs
    };
    
    // Set global log config
    setLogConfig(globalConfig);

    logInfo(`Handling request: ${req.url}`);

    // ===== URL and Path Handling =====
    const formatImportUrl = config.formatImportUrl || ((importUrl: URL) => {
        const pathname = importUrl.pathname;
        const ext = modules.path.extname(pathname);
        // Remove extension from matchPath
        let matchPath = ext ? pathname?.replace(ext, '') : pathname;
        matchPath = matchPath?.replaceAll(/\[([^\[\]]+)\]/g, ':$1');
        const dirEntrypointIndex = matchPath?.lastIndexOf(`/${config?.dirEntrypoint}`)
        matchPath = dirEntrypointIndex > -1 ? matchPath.slice(0, dirEntrypointIndex) : matchPath;

        const isolateSearchUrl = new URL(importUrl.href)
        isolateSearchUrl.pathname = matchPath;
        logDebugWithConfig(config, `Formatted import URL: ${isolateSearchUrl.href}`);
        return isolateSearchUrl.href;
    });

    const mapFilePathToIsolateId = ((fileUrl: URL) => {
        const customMapperId = config.mapFilePathToIsolateId ||
            (({ formattedFileUrl, fileUrl }: { fileUrl: string, formattedFileUrl: string }) => {
                const _url = new URL(fileUrl);
                const ext = modules.path.extname(_url.pathname);
                const isJSX = ext === '.jsx' || ext === '.tsx';
                return isJSX ? `jsx|tsx` : 'js|ts';
            });

        // Format File Path
        const filePathUrl = new URL(fileUrl.href);
        // Set host to the original url host
        filePathUrl.host = url.host;
        // Remove search params from the URL
        filePathUrl.search = '';

        // matchPath is the path to match in the URL
        let ext = filePathUrl.pathname.split('.').pop();
        ext = ext ? `.${ext}` : ext;

        // Remove extension from matchPath
        filePathUrl.pathname = ext ? filePathUrl.pathname.replace(ext, '') : filePathUrl.pathname;
        filePathUrl.pathname = filePathUrl.pathname.replaceAll(/\[([^\[\]]+)\]/g, ':$1');

        const dirEntrypointIndex = filePathUrl.pathname?.lastIndexOf(`/${config?.dirEntrypoint}`)
        filePathUrl.pathname = dirEntrypointIndex > -1 ? filePathUrl.pathname.slice(0, dirEntrypointIndex) : filePathUrl.pathname;

        const formattedFileUrl = filePathUrl.href;

        // Get the isolate ID
        return customMapperId({ formattedFileUrl, fileUrl: fileUrl.href });
    });

    // ===== Process Request Function =====
    async function processRequest(isolateId: string, metadata: IsolateMetadata): Promise<Response> {
        try {
            logInfo(`Processing request for isolate ${isolateId} with status ${metadata.status}`);
            const port = isolateManager.getPortFromIsolateId(isolateId);

            // Increment active requests counter
            isolateManager.incrementActiveRequests(isolateId);

            // Prepare request to the isolate
            const requestUrl = new URL(
                `${url.pathname}?${new URLSearchParams({
                    ...queryParams,
                    ...(metadata.params || {}),
                    "__importUrl__": btoa(importUrl.href),
                    "__isJSX__": String(isJSX), // Convert boolean to string
                    "__proxyUrl__": btoa(url.href),
                })}`,
                `http://localhost:${port}`
            );

            logDebugWithConfig(config, `Forwarding request to isolate at: ${requestUrl.href}`);

            const moduleResponse = await fetch(requestUrl, {
                method: req.method,
                redirect: "manual",
                headers: req.headers,
                body: req.body
            });

            logDebugWithConfig(config, `Received response from isolate with status: ${moduleResponse.status}`);

            // Process the response stream
            const transformStream = new TransformStream({
                start() {
                    logDebugWithConfig(config, `Starting response stream transform`);
                },
                transform(chunk, controller) {
                    controller.enqueue(chunk);
                },
                flush(controller) {
                    logDebugWithConfig(config, `Flushing response stream transform`);
                    controller.terminate();
                    // Decrement active requests counter and reset timer if needed
                    isolateManager.decrementActiveRequests(isolateId, config);
                },
                async cancel() {
                    logDebugWithConfig(config, `Cancelling response stream transform`);
                    // Decrement active requests counter and reset timer if needed
                    isolateManager.decrementActiveRequests(isolateId, config);
                },
            });

            const responseStream = moduleResponse.body?.pipeThrough(transformStream);

            return new Response(responseStream, {
                headers: moduleResponse.headers,
                status: moduleResponse.status,
                statusText: moduleResponse.statusText,
            });
        } catch (error) {
            logError(`Error communicating with isolate server for ${isolateId}:`, error);
            await isolateManager.cleanupIsolate(isolateId);
            return new Response(JSON.stringify(error), {
                status: 500,
                statusText: 'Bad Request',
                headers: { 'content-type': 'application/json' }
            });
        }
    }

    // ===== Wait for Loading Isolate =====
    async function waitForIsolateToLoad(isolateId: string): Promise<IsolateMetadata | undefined> {
        if (!isolateId) {
            logError(`Cannot wait for isolate to load: isolateId is undefined`);
            return undefined;
        }
        
        logDebugWithConfig(config, `Isolate is loading. Waiting for it to finish: ${isolateId}`);
        let status = isolateManager.getIsolate(isolateId)?.status;

        // Poll until the isolate is no longer loading
        while (status === 'loading') {
            await new Promise(resolve => setTimeout(resolve, 100));
            status = isolateManager.getIsolate(isolateId)?.status;
        }

        return isolateManager.getIsolate(isolateId);
    }

    // ===== Create or Update Isolate =====
    async function createOrUpdateIsolate(isolateId: string, metadata: IsolateMetadata): Promise<Response | undefined> {
        // Set status to loading
        isolateManager.updateIsolate(isolateId, { status: 'loading' });

        try {
            logInfo(`Spawning isolate ${isolateId}`);

            // Prepare URLs for reload if needed
            const metaUrl = new URL(import.meta.url)?.origin !== "null" ? new URL(import.meta.url) : null;
            metaUrl && (metaUrl.pathname = '');
            metaUrl && (metaUrl.search = '');
            metaUrl && (metaUrl.hash = '');

            const reloadUrl = new URL(formattedImportUrl);
            reloadUrl.pathname = '';

            // Initialize reload as string array or undefined
            let reload: string[] | undefined;
            if (bustCache) {
                // Filter out undefined values and ensure all elements are strings
                reload = [reloadUrl.href, metaUrl?.href, url.origin].filter(Boolean) as string[];
                logDebugWithConfig(config, `Upgrading isolate id ${isolateId}`);
            } else {
                logDebugWithConfig(config, `Spawning isolate id ${isolateId}`);
            }

            // Get an available port
            let port;
            try {
                port = await isolateManager.getAvailablePort(3500, 4000);
                logInfo(`Allocated port ${port} for isolate ${isolateId}`);
            } catch (portError) {
                logError(`Failed to allocate port for isolate ${isolateId}:`, portError);
                return new Response(JSON.stringify({
                    error: {
                        message: 'Failed to allocate port for isolate',
                        details: portError instanceof Error ? portError.message : String(portError)
                    }
                }), {
                    status: 500,
                    headers: { 'content-type': 'application/json' }
                });
            }

            // Prepare project directory
            const projectId = config.projectId || new URL(formattedImportUrl).username;
            config.projectId = projectId;

            try {
            await modules.fs.ensureDir(`./data/${projectId}`);
                logDebugWithConfig(config, `Ensured project directory ./data/${projectId}`);
            } catch (dirError) {
                logError(`Failed to create project directory for ${projectId}:`, dirError);
                return new Response(JSON.stringify({
                    error: {
                        message: 'Failed to create project directory',
                        details: dirError instanceof Error ? dirError.message : String(dirError)
                    }
                }), {
                    status: 500,
                    headers: { 'content-type': 'application/json' }
                });
            }

            // Create the isolate
            let isolateInstance;
            try {
                logDebugWithConfig(config, `Creating isolate with type: ${config.isolateType}`);
                isolateInstance = await isolateFactory({
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
                bustCache,
                permissions: config.permissions,
                    env: { ...(metadata.variables || {}), ...config.variables, IMPORT_URL: fileLoaderUrl.href }
                });
                logInfo(`Successfully created isolate instance for ${isolateId}`);
            } catch (isolateError) {
                logError(`Failed to create isolate instance for ${isolateId}:`, isolateError);
                return new Response(JSON.stringify({
                    error: {
                        message: 'Failed to create isolate instance',
                        details: isolateError instanceof Error ? isolateError.message : String(isolateError)
                    }
                }), {
                    status: 500,
                    headers: { 'content-type': 'application/json' }
                });
            }

            // Set up error handler for worker isolates
            if (config.isolateType === 'worker') {
                logDebugWithConfig(config, `Setting up error handler for worker isolate ${isolateId}`);
                (isolateInstance as Worker).onerror = (error: ErrorEvent) => {
                    logError(`Error in isolate ${isolateId}:`, error);
                    isolateManager.cleanupIsolate(isolateId);
                };
            }

            // Wait for the isolate server to be ready
            try {
                logDebugWithConfig(config, `Waiting for isolate server at http://localhost:${port}/__healthcheck__`);
            await waitForServer(`http://localhost:${port}/__healthcheck__`);
                logInfo(`Isolate server for ${isolateId} is ready on port ${port}`);
            } catch (serverError) {
                logError(`Failed to connect to isolate server for ${isolateId}:`, serverError);
                await isolateManager.cleanupIsolate(isolateId);
                return new Response(JSON.stringify({
                    error: {
                        message: 'Failed to connect to isolate server',
                        details: serverError instanceof Error ? serverError.message : String(serverError)
                    }
                }), {
                    status: 500,
                    headers: { 'content-type': 'application/json' }
                });
            }

            // Update isolate metadata based on type
            if (config.isolateType === 'subprocess') {
                // Clean up existing isolate if needed
                const currentMetadata = isolateManager.getIsolate(isolateId);
                if (currentMetadata?.pid) {
                    logDebugWithConfig(config, `Cleaning up existing subprocess isolate ${isolateId}`);
                    await isolateManager.cleanupIsolate(isolateId);
                }

                // Set new isolate metadata
                const pid = (isolateInstance as Deno.ChildProcess).pid;
                logInfo(`Setting subprocess isolate metadata for ${isolateId} with pid ${pid}`);
                isolateManager.setIsolate(isolateId, {
                    ...metadata,
                    port,
                    pid,
                    instance: isolateInstance,
                    status: 'up',
                    loadedAt: Date.now()
                });
            } else {
                // Clean up existing isolate if needed
                const currentMetadata = isolateManager.getIsolate(isolateId);
                if (currentMetadata?.worker) {
                    logDebugWithConfig(config, `Cleaning up existing worker isolate ${isolateId}`);
                    await isolateManager.cleanupIsolate(isolateId);
                }

                // Set new isolate metadata
                logInfo(`Setting worker isolate metadata for ${isolateId}`);
                isolateManager.setIsolate(isolateId, {
                    ...metadata,
                    port,
                    worker: isolateInstance as Worker,
                    status: 'up',
                    loadedAt: Date.now()
                });
            }

            return undefined; // No error response
        } catch (error) {
            logError(`Failed to spawn isolate: ${isolateId}`, error);
            // Make sure to update the isolate status to down
            isolateManager.updateIsolate(isolateId, { status: 'down' });
            return new Response(JSON.stringify({
                error: {
                    message: 'Bad Request. Failed to initialize Isolate',
                    details: error instanceof Error ? error.message : String(error)
                }
            }), {
                status: 500,
                headers: { 'content-type': 'application/json' }
            });
        }
    }

    // ===== Handle Public File Request =====
    async function handlePublicFile(): Promise<Response | undefined> {
    if (importUrl.href && config?.publicDir) {
        const publicDirPath = new URL(`/${config.publicDir.split('/').filter(Boolean).join('/')}`, importUrl).pathname;

        if (importUrl.pathname.startsWith(publicDirPath)) {
            const response = await fetch(importUrl);
            return new Response(await response.blob(), {
                    headers: response.headers,
                    status: response.status
                });
            }
        }
        return undefined;
    }

    // ===== Load Metadata =====
    async function loadMetadata(): Promise<Response | undefined> {
        if (!isolateMetadata || queryParams.bundle || !isExactMatch) {
            logInfo(`Loading metadata for import URL: ${importUrl.href}`);

            // Prepare file loader URL
            const searchParams = new URLSearchParams(importUrl.search);
            searchParams.set('__metadata__', 'true');

            // Log all search parameters for debugging
            logDebugWithConfig(config, `Search parameters for metadata request:`);
            for (const [key, value] of searchParams.entries()) {
                logDebugWithConfig(config, `  ${key}: ${value}`);
            }

            fileLoaderUrl = new URL(config.loaderUrl);
            logDebugWithConfig(config, `Base loader URL: ${fileLoaderUrl.href}`);

            fileLoaderUrl.pathname = modules.path.join(fileLoaderUrl.pathname, importUrl.pathname);
            logDebugWithConfig(config, `Loader URL with pathname: ${fileLoaderUrl.href}`);

            fileLoaderUrl.search = searchParams.toString();
            logDebugWithConfig(config, `Final loader URL: ${fileLoaderUrl.href}`);

            logInfo(`Fetching metadata from: ${fileLoaderUrl.href}`);

            // Fetch metadata with application/json content-type header
            let isolateMetadataRes;
            try {
                // Create headers with application/json content-type
                const headers = new Headers();
                headers.set('Content-Type', 'application/json');
                headers.set('Accept', 'application/json');

                logDebugWithConfig(config, `Sending request with headers: Content-Type: ${headers.get('Content-Type')}, Accept: ${headers.get('Accept')}`);

                isolateMetadataRes = await fetch(fileLoaderUrl, {
                    headers: headers
                });

                logDebugWithConfig(config, `Metadata fetch status: ${isolateMetadataRes.status}, content-type: ${isolateMetadataRes.headers.get('content-type')}`);

                // If the response is not OK, try again without the JSON headers
                if (!isolateMetadataRes.ok && isolateMetadataRes.status === 415) {
                    logWarning(`Server rejected JSON content-type (${isolateMetadataRes.status}), retrying without JSON headers`);

                    isolateMetadataRes = await fetch(fileLoaderUrl);
                    logDebugWithConfig(config, `Retry fetch status: ${isolateMetadataRes.status}, content-type: ${isolateMetadataRes.headers.get('content-type')}`);
                }
            } catch (error) {
                logError(`Error fetching metadata:`, error);
                return new Response(
                    JSON.stringify({ error: { message: 'Error fetching metadata' } }),
                    { status: 500, headers: { 'content-type': 'application/json' } }
                );
            }

            if (!isolateMetadataRes.ok) {
                logError(`Error importing metadata: ${isolateMetadataRes.statusText}`);
                return new Response(
                    JSON.stringify({ error: { message: isolateMetadataRes.statusText } }),
                    { status: isolateMetadataRes.status || 500, headers: { 'content-type': 'application/json' } }
                );
            }

            // Check the content type of the response
            const contentType = isolateMetadataRes.headers.get('content-type') || '';
            logDebugWithConfig(config, `Response content type: ${contentType}`);

            // Get the response text first
            let responseText;
            try {
                responseText = await isolateMetadataRes.text();
                logDebugWithConfig(config, `Received response text (first 100 chars): ${responseText.substring(0, 100)}...`);
            } catch (err) {
                logError(`Error reading response text:`, err);
                return new Response(
                    JSON.stringify({ error: { message: 'Bad Request - Could not read response' } }),
                    { status: 500, headers: { 'content-type': 'application/json' } }
                );
            }

            // Parse the response based on content type
            let _isolateMetadata;

            if (contentType.includes('application/json')) {
                // It's JSON, try to parse it
                try {
                    _isolateMetadata = JSON.parse(responseText);
                    logDebugWithConfig(config, `Successfully parsed metadata JSON`);
                } catch (err) {
                    logError(`Error parsing metadata JSON:`, err);
                    return new Response(
                        JSON.stringify({ error: { message: 'Bad Request - Invalid metadata format' } }),
                        { status: 500, headers: { 'content-type': 'application/json' } }
                    );
                }
            } else {
                // Not JSON, it's the file content
                logInfo(`Received non-JSON response (${contentType}), treating as file content`);

                // Create a fallback metadata object
                _isolateMetadata = {
                    matchPath: importUrl.pathname,
                    path: importUrl.pathname,
                    content: responseText,
                    params: {}
                };

                logInfo(`Created metadata from file content`);
            }

            // matchPath is the path to match in the URL
            const matchUrl = new URL(importUrl.href);
            matchUrl.pathname = _isolateMetadata?.matchPath || importUrl.pathname;
            isolateId = mapFilePathToIsolateId(matchUrl);
            logInfo(`Mapped to isolate ID: ${isolateId}`);

            const ext = modules.path.extname(matchUrl.pathname);
            isJSX = ext === '.jsx' || ext === '.tsx';

            if (queryParams.bundle) {
                if (isJSX) {
                    logInfo(`Returning bundled JSX content`);

                    // If we have content from a non-JSON response, use that directly
                    const content = _isolateMetadata.content || '';

                    // Determine the appropriate content type
                    const contentType = isJSX ? 'text/javascript' : 'text/plain';

                    return new Response(
                        content,
                        {
                            status: 200,
                            headers: {
                                'content-type': contentType,
                                'access-control-allow-origin': '*'
                            }
                        }
                    );
                } else {
                    logInfo(`Bundle requested for non-JSX file, returning 404`);
                    return new Response(
                        JSON.stringify({ error: { message: 'Not Found' } }),
                        { status: 404, headers: { 'content-type': 'application/json' } }
                    );
                }
            }

            // Get updated state of isolate metadata
            const existingIsolateMetadata = isolateManager.getIsolate(isolateId);

            // Create a new metadata object with defaults if none exists
            const newIsolateMetadata: IsolateMetadata = {
                activeRequests: 0,
                status: 'down',
                ...(existingIsolateMetadata || {}),
                ..._isolateMetadata,
                paths: [...(existingIsolateMetadata?.paths || []), _isolateMetadata.path || importUrl.pathname]
            };

            isolateMetadata = newIsolateMetadata;

            // Set isolate metadata
            logInfo(`Setting isolate metadata for ${isolateId}`);
            if (isolateId) {
                isolateManager.setIsolate(isolateId, isolateMetadata);
            } else {
                logError(`Cannot set isolate metadata: isolateId is undefined`);
            }
        }

        formattedImportUrl = formatImportUrl(importUrl);
        return undefined;
    }

    // ===== Main Request Flow =====

    // Initialize variables
    const url = new URL(req.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    if (!config?.isolateType) {
        config.isolateType = config.env.ISOLATE_TYPE || 'subprocess';
    }

    // Check if loaderUrl is configured
    if (!config.loaderUrl) {
        logError(`Missing loaderUrl configuration`);
        return new Response(
            JSON.stringify({ error: { message: 'Server configuration error: Missing loaderUrl' } }),
            { status: 500, headers: { 'content-type': 'application/json' } }
        );
    }

    logDebugWithConfig(config, `Using loader URL: ${config.loaderUrl}`);

    const importUrl = new URL(modules.path.join(config.loaderUrl, config.functionsDir || ''))
    importUrl.pathname = modules.path.join(importUrl.pathname, url.pathname).split('/').filter(Boolean).join('/');
    importUrl.search = url.search;

    logInfo(`Processing import URL: ${importUrl.href}`);

    // Initialize variables
    let isolateId: string | undefined;
    let isJSX = false;
    let isolateMetadata: IsolateMetadata | undefined;
    let bustCache = false;
    let fileLoaderUrl: URL;
    let formattedImportUrl: string;
    let isExactMatch = false;

    // Sort cached URLs by number of path parameters (more specific routes first)
    const matchesParams = (url: string) => url.split('/').filter((part) => part.startsWith(':')).length;
    const sortedFileUrls = isolateManager.getCachedFileUrls()?.sort((a, b) => matchesParams(b) - matchesParams(a));

    // ===== URL Matching and Isolate Identification =====
    logDebugWithConfig(config, `Searching for matching URL in ${sortedFileUrls.length} cached URLs`);

    // Try to find a matching URL in the cache
    for (const fileUrl of sortedFileUrls) {
        const { pathname, hostname, username } = new URL(fileUrl);
        const pattern = new URLPattern({ username, pathname, hostname });

        logDebugWithConfig(config, `Testing pattern ${pathname} against ${importUrl.href}`);

        if (pattern.test(importUrl.href)) {
            const cachedData = isolateManager.getCachedFileUrl(fileUrl);
            if (!cachedData) {
                logDebugWithConfig(config, `No cached data for ${fileUrl}`);
                continue;
            }

            // Get isolate ID from the matched URL
            const matchUrl = new URL(importUrl.href);
            matchUrl.pathname = cachedData.matchPath;
            isolateId = mapFilePathToIsolateId(matchUrl);

            // Check if this is an exact match
            isExactMatch = cachedData.path === importUrl.pathname;

            logInfo(`Found matching URL: ${fileUrl}, isolateId: ${isolateId}, exactMatch: ${isExactMatch}`);

            // Get isolate metadata
            const existingMetadata = isolateManager.getIsolate(isolateId);
            if (existingMetadata) {
                isolateMetadata = existingMetadata;
                logDebugWithConfig(config, `Found existing isolate metadata with status: ${existingMetadata.status}`);
            } else {
                isolateMetadata = { activeRequests: 0, status: 'down' };
                logDebugWithConfig(config, `No existing isolate metadata, creating default`);
            }

            // If exact match, we're done
            if (isExactMatch) {
                logInfo(`Exact match found, using isolate: ${isolateId}`);
                break;
            }
        }
    }

    try {
        // 1. Check if this is a public file request
        const publicFileResponse = await handlePublicFile();
        if (publicFileResponse) {
            logInfo(`Returning public file response`);
            return publicFileResponse;
        }

        // 2. Load metadata if needed
        const metadataResponse = await loadMetadata();
        if (metadataResponse) {
            logInfo(`Returning metadata response`);
            return metadataResponse;
        }

        // Ensure we have an isolateId at this point
        if (!isolateId || !isolateMetadata) {
            logError(`Missing isolateId or isolateMetadata after loading metadata`);
            return new Response(JSON.stringify({
                error: {
                    message: 'Bad Request. Invalid isolate configuration.',
                    details: `isolateId: ${isolateId ? 'defined' : 'undefined'}, isolateMetadata: ${isolateMetadata ? 'defined' : 'undefined'}`
                }
            }), {
                status: 500,
                headers: { 'content-type': 'application/json' }
            });
        }

        // 3. Clear any existing timer
        const existingIsolate = isolateManager.getIsolate(isolateId);
        if (existingIsolate?.timer) {
            clearTimeout(existingIsolate.timer);
            logDebugWithConfig(config, `Cleared existing timer for isolate ${isolateId}`);
        }

        // 4. Check if we need to bust the cache
        const shouldUpgradeAfter = config?.shouldUpgradeAfter || 0;
        bustCache = Boolean(isolateMetadata?.loadedAt && (isolateMetadata?.loadedAt <= shouldUpgradeAfter));
        logDebugWithConfig(config, `Bust cache: ${bustCache}`);

        // 5. If isolate is already up and we don't need to bust cache, process the request
        if (isolateMetadata.status === 'up' && !bustCache) {
            logInfo(`Using existing isolate ${isolateId} with status: up`);
            return await processRequest(isolateId, isolateMetadata);
        }

        // 6. If isolate is loading, wait for it
        if (isolateMetadata.status === 'loading') {
            logInfo(`Waiting for isolate ${isolateId} to finish loading`);
            const updatedMetadata = await waitForIsolateToLoad(isolateId);
            if (updatedMetadata?.status === 'up') {
                logInfo(`Isolate ${isolateId} is now up, processing request`);
                return await processRequest(isolateId, updatedMetadata);
            } else {
                logError(`Isolate ${isolateId} failed to initialize`);
                return new Response(JSON.stringify({
                    error: {
                        message: 'Failed to initialize Isolate',
                        details: `Isolate status: ${updatedMetadata?.status || 'unknown'}`
                    }
                }), {
                    status: 500,
                    headers: { 'content-type': 'application/json' }
                });
            }
        }

        // 7. Create or update the isolate
        logInfo(`Creating/updating isolate ${isolateId}`);
        const errorResponse = await createOrUpdateIsolate(isolateId, isolateMetadata);
        if (errorResponse) {
            logError(`Error creating/updating isolate ${isolateId}`);
            return errorResponse;
        }

        // 8. Process the request with the newly created/updated isolate
        const finalMetadata = isolateManager.getIsolate(isolateId);
        if (!finalMetadata || finalMetadata.status !== 'up') {
            logError(`Isolate ${isolateId} is not up after creation/update, status: ${finalMetadata?.status || 'undefined'}`);
            return new Response(JSON.stringify({
                error: {
                    message: 'Failed to initialize Isolate',
                    details: `Isolate status: ${finalMetadata?.status || 'undefined'}`
                }
            }), {
                status: 500,
                headers: { 'content-type': 'application/json' }
            });
        }

        logInfo(`Processing request with newly created/updated isolate ${isolateId}`);
        return await processRequest(isolateId, finalMetadata);
    } catch (error) {
        logError(`Unhandled error in request handler:`, error);

        // Try to clean up the isolate if it exists
        if (isolateId) {
            try {
                await isolateManager.cleanupIsolate(isolateId);
                logInfo(`Cleaned up isolate ${isolateId} after error`);
            } catch (cleanupError) {
                logError(`Failed to clean up isolate ${isolateId} after error:`, cleanupError);
            }
        }

        return new Response(JSON.stringify({
            error: {
                message: 'Internal Server Error',
                details: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            }
        }), {
            status: 500,
            headers: { 'content-type': 'application/json' }
        });
    }
};