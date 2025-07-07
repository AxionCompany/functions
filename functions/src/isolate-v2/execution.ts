import { ModuleLoader, LoadedModule } from "./loader.ts";
import { withDatabase, cleanupDatabase, DatabaseDependencies } from "./utils/withDatabase.ts";
import { buildRequestContext, RequestContext } from "./context.ts";
import { OxianContext, RequestData, ResponseHandler, Handler } from "./types.ts";
import { withHooks } from "./utils/withHooks.ts";

export class ModuleExecutor {
    private config: any;
    private withCache: Function;
    private moduleLoader: ModuleLoader;
    private moduleCache = new Map<string, LoadedModule>();
    private dbDependencies: DatabaseDependencies | null = null;

    constructor(options: { config: any, withCache: Function }) {
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

    private async getDbDependencies(schemaSQL: string[] = []) {
        // If the database connection already exists, we might just need to update schemas
        if (this.dbDependencies?.db) {
            // If new SQL is provided, you might want to execute it against the existing connection.
            // For now, we assume schema is set at initialization.
            // If dynamic schema updates are needed, this is where the logic would go.
            return this.dbDependencies;
        }

        this.dbDependencies = await withDatabase(this.dbDependencies || { withCache: this.withCache }, {
            database: this.config.database,
            projectPath: this.config.projectPath || Deno.cwd(),
            isolateId: this.config.isolateId || 'default',
            schemaSQL,
        });

        return this.dbDependencies;
    }

    public async execute(rawRequestData: RequestData, responseHandler: ResponseHandler): Promise<any> {

        const { __proxyUrl__, __importUrl__, __isJSX__, ...queryParams } = rawRequestData.queryParams;

        const importUrl = atob(__importUrl__);
        const url = atob(__proxyUrl__);

        if (importUrl.endsWith('.jsx') || importUrl.endsWith('.tsx')) {
            throw new Error(`[IsolateV2] Frontend modules are not supported.`);
        }

        const reqContext = await buildRequestContext(importUrl, this.moduleLoader, { env: this.config.env });

        // now that we have the schemas, we can connect to the database
        const dbDeps = await this.getDbDependencies(reqContext.schemaSQL);

        reqContext.dependencies = { ...dbDeps, ...reqContext.dependencies };

        const loadedModule = await this.loadModule(importUrl);

        // --- Data and Context Assembly ---
        const data = { ...rawRequestData.body, ...queryParams, ...rawRequestData.formData };
        const oxianContext = this.createOxianContext({ ...rawRequestData, url, queryParams }, responseHandler, reqContext.dependencies, this.config.env);

        const httpMethod = (rawRequestData.method?.toUpperCase() || 'DEFAULT') as keyof LoadedModule;
        const tempTargetFunction = loadedModule[httpMethod] || loadedModule.default;

        if (typeof tempTargetFunction !== 'function') {
            throw new Error(`Module ${importUrl} has no default export or a handler for ${httpMethod}.`);
        }


        let targetFunction;
        // If the module is a factory, we need to call it with the dependencies
        if (reqContext.isFactory) {
            targetFunction = tempTargetFunction({ ...oxianContext.dependencies, env: oxianContext.env });
        }
        // If the module is bound, we need to bind it to the dependencies
        else if (reqContext.isBound) {
            targetFunction = tempTargetFunction.bind({ ...oxianContext.dependencies, env: oxianContext.env });
        }
        // Otherwise, we can just use the module directly
        else {
            targetFunction = tempTargetFunction;
        }

        const executionChain = this.buildExecutionChain(targetFunction, reqContext);

        return await executionChain(data, oxianContext);
    }

    private async loadModule(importUrl: string): Promise<LoadedModule> {
        const bustCache = this.config.bustCache || false;
        if (!bustCache && this.moduleCache.has(importUrl)) {
            return this.moduleCache.get(importUrl)!;
        }
        const module = await this.moduleLoader.load(importUrl, bustCache);
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
                // A middleware can optionally return a new data object to be passed down the chain.
                const nextData = middleware(data, context);
                console.log('Original Data', data)
                console.log('Middleware Output', nextData)
                if (nextData && typeof (nextData as any).then === 'function') {
                    return (nextData as Promise<any>).then(resolvedData => next(resolvedData || data, context));
                }
                console.log('Running', next.name, 'with', nextData)

                return next(nextData || data, context);
            },
            withHooks(targetFn, reqContext.interceptor)
        );

        return finalFn;
    }
} 