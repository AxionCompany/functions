import { ModuleLoader, LoadedModule } from "./loader.ts";
import { withDatabase, cleanupDatabase, DatabaseDependencies } from "./utils/withDatabase.ts";
import { buildRequestContext, RequestContext } from "./context.ts";
import { OxianContext, RequestData, ResponseHandler, Handler, IsolateConfig } from "./types.ts";
import { withHooks } from "./utils/withHooks.ts";
import { enhanceErrorWithSourceMap } from "./utils/sourceMapSupport.ts";

export class ModuleExecutor {
    private config: IsolateConfig;
    private withCache: Function;
    private moduleLoader: ModuleLoader;
    private moduleCache = new Map<string, LoadedModule>();
    private dbDependencies: DatabaseDependencies | null = null;

    constructor(options: { config: IsolateConfig, withCache: Function }) {
        this.config = options.config;
        this.withCache = options.withCache;
        this.moduleLoader = new ModuleLoader({
            projectPath: this.config.projectPath || Deno.cwd(),
        });
        this.setupSignalHandlers();
    }

    private setupSignalHandlers() {
        const cleanup = async () => {
            if (this.dbDependencies) await cleanupDatabase(this.dbDependencies);
        };
        if (typeof Deno !== 'undefined') {
            Deno.addSignalListener("SIGTERM", cleanup);
        }
        if (typeof self !== 'undefined') {
            self.addEventListener("beforeunload", cleanup);
        }
    }

    private async getDbDependencies(schemaSQL: string[] = [], schema: Record<string, any> = {}) {
        // If the database connection already exists, we might just need to update schemas
        if (this.dbDependencies?.db) {
            return this.dbDependencies;
        }

        this.dbDependencies = await withDatabase(this.dbDependencies || { withCache: this.withCache }, {
            database: this.config.database,
            projectPath: this.config.projectPath || Deno.cwd(),
            isolateId: this.config.isolateId || 'default',
            schemaSQL,
            schema,
        });

        return this.dbDependencies;
    }

    public async execute(rawRequestData: RequestData, responseHandler: ResponseHandler): Promise<any> {

        // Get import URL from environment variables or proxy headers
        let importUrl = this.config.importUrl;
        let url = rawRequestData.url;

        // Check for proxy headers first (when running through proxy)
        if (rawRequestData.headers['x-import-url']) {
            importUrl = rawRequestData.headers['x-import-url'];
        }
        if (rawRequestData.headers['x-proxy-url']) {
            url = rawRequestData.headers['x-proxy-url'];
        }

        // Fallback to environment variables
        if (!importUrl) {
            importUrl = this.config.env.IMPORT_URL || this.config.env.IMPORT_PATH;
        }

        // Final fallback: derive from request pathname
        if (!importUrl) {
            const urlObj = typeof (rawRequestData.url as any)?.href === 'string' ? (rawRequestData.url as any) : new URL(String(rawRequestData.url));
            const routePath = (rawRequestData as any).pathname || urlObj.pathname || '/';
            if (this.config.loaderUrl) {
                importUrl = new URL(routePath, this.config.loaderUrl).href;
            } else {
                const base = (this.config.functionsDir || this.config.projectPath).replace(/\/$/, '');
                importUrl = `file://${base}${routePath}`;
            }
        }

        // Remove query params that were used for proxy communication
        const { __proxyUrl__, __importUrl__, __isJSX__, ...queryParams } = rawRequestData.queryParams;

        if (importUrl.endsWith('.jsx') || importUrl.endsWith('.tsx')) {
            throw new Error(`[IsolateV2] Frontend modules are not supported.`);
        }

        const requestHeaders = new Headers(rawRequestData.headers || {});
        const configWithHeaders: IsolateConfig = { ...this.config, headers: requestHeaders };
        const reqContext = await buildRequestContext(importUrl, this.moduleLoader, { env: this.config.env }, configWithHeaders);
        reqContext.requestId = rawRequestData.__requestId__ || crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;

        // now that we have the schemas, we can connect to the database
        const dbDeps = await this.getDbDependencies(reqContext.schemaSQL, reqContext.dependencies.schema);

        reqContext.dependencies = { ...dbDeps, ...reqContext.dependencies };

        const loadedModule = await this.loadModule(importUrl, { ...configWithHeaders, requestId: reqContext.requestId } as any);

        // --- Data and Context Assembly ---
        // Ensure per-request params are resolved even when module is cached
        if (reqContext.requestId) {
            await this.moduleLoader.resolvePathParams(importUrl, { ...this.config, requestId: reqContext.requestId } as any);
        }
        const pathParams = (reqContext.requestId && this.moduleLoader.getPathParamsForRequest(reqContext.requestId, importUrl))
            || this.moduleLoader.getPathParamsForRoot(importUrl)
            || {};
        const data = { ...pathParams, ...rawRequestData.body, ...queryParams, ...rawRequestData.formData };
        const oxianContext = this.createOxianContext({ ...rawRequestData, url, queryParams, params: pathParams }, responseHandler, reqContext.dependencies, this.config.env);

        const httpMethod = (rawRequestData.method?.toUpperCase() || 'DEFAULT') as keyof LoadedModule;
        const tempTargetFunction = loadedModule[httpMethod] || loadedModule.default;

        if (typeof tempTargetFunction !== 'function') {
            throw new Error(`Module ${importUrl} has no default export or a handler for ${httpMethod}.`);
        }

        let targetFunction;
        if (reqContext.isFactory) {
            targetFunction = tempTargetFunction({ ...oxianContext.dependencies, env: oxianContext.env });
        }
        else if (reqContext.isBound) {
            targetFunction = tempTargetFunction.bind({ ...oxianContext.dependencies, env: oxianContext.env });
        }
        else {
            targetFunction = tempTargetFunction;
        }

        const executionChain = this.buildExecutionChain(async (data, context) => {
            try {
                return await targetFunction(data, context);
            } catch (err) {
                // Map runtime error using the bundled code if available
                const bundledCode = this.moduleLoader.getBundledCode(importUrl);
                if (bundledCode && err instanceof Error) {
                    const enhancedError = enhanceErrorWithSourceMap(err, bundledCode, importUrl);
                    if ('applyMappedStack' in enhancedError) {
                        await (enhancedError as any).applyMappedStack(importUrl);
                    }
                    throw enhancedError;
                }
                throw err;
            } finally {
                if (reqContext.requestId) {
                    this.moduleLoader.clearPathParamsForRequest(reqContext.requestId);
                }
            }
        }, reqContext);

        return await executionChain(data, oxianContext);
    }

    private async loadModule(importUrl: string, configOverride?: IsolateConfig): Promise<LoadedModule> {
        const bustCache = (configOverride?.bustCache ?? this.config.bustCache) || false;
        if (!bustCache && this.moduleCache.has(importUrl)) {
            return this.moduleCache.get(importUrl)!;
        }
        const module = await this.moduleLoader.load(importUrl, bustCache, configOverride || this.config);
        this.moduleCache.set(importUrl, module);
        return module;
    }

    private createOxianContext(req: RequestData, res: ResponseHandler, deps: any, env: any): OxianContext {
        const state: Map<string, any> = new Map();
        return {
            requestId: req.__requestId__,
            request: {
                url: req.url,
                method: req.method,
                headers: req.headers,
                body: req.body,
                queryParams: req.queryParams,
                params: (req as any).params,
            },
            response: res,
            dependencies: deps,
            env: env || {},
            _state: state,
            get: (key) => state.get(key),
            set: (key, value) => { state.set(key, value); },
        };
    }

    private buildExecutionChain(
        targetFn: Handler,
        reqContext: RequestContext
    ): (data: Record<string, any>, context: OxianContext | any) => Promise<any> {

        const finalFn: Handler = reqContext.middlewares.reduceRight(
            (next, middleware) => (data, context) => {
                const nextData = middleware(data, context);
                if (nextData && typeof (nextData as any).then === 'function') {
                    return (nextData as Promise<any>).then(resolvedData => next(resolvedData || data, context));
                }
                return next(nextData || data, context);
            },
            withHooks(targetFn, reqContext.interceptor)
        );

        return finalFn;
    }
} 