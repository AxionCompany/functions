import type { ModuleLoader } from "./loader.ts";
import { findContextualModules } from "./utils/finder.ts";
import type { OxianContext, Handler, IsolateConfig } from "./types.ts";
import type { OxianConfig } from "../../../api.ts";

/**
 * Defines the structure for the processed contextual modules.
 */
export interface RequestContext {
    dependencies: any;
    middlewares: Handler[];
    interceptor: {
        beforeRun?: Handler;
        afterRun?: (data: Record<string, any>, context: OxianContext) => Promise<any> | any;
    };
    schemaSQL: string[];
    schema: Record<string, any>;
    isFactory?: boolean;
    isBound?: boolean;
    env: any;
    requestId?: string;
}

export const CONTEXTUAL_MODULE_NAMES = ["shared", "dependencies", "middleware", "interceptor", "schema"];


/**
 * Builds the request-specific context by finding, loading, and processing
 * all relevant shared, middleware, and interceptor modules.
 * @param importUrl The URL of the target function module for the current request.
 * @param moduleLoader An instance of the ModuleLoader to use for importing.
 * @param initialDependencies The base dependencies (e.g., from withDatabase).
 * @param config The Oxian config.
 * @returns A promise that resolves to the fully built RequestContext.
 */
export async function buildRequestContext(
    importUrl: string,
    moduleLoader: ModuleLoader,
    initialDependencies: any,
    config: IsolateConfig
): Promise<RequestContext> {

    // Use a per-request copy to avoid mutating the shared array across requests
    const contextualNames = [...CONTEXTUAL_MODULE_NAMES];
    const namesToSearch = !config.database?.enabled
        ? contextualNames.filter((n) => n !== "schema")
        : contextualNames;

    const foundFiles = await findContextualModules(importUrl, moduleLoader, namesToSearch, config);

    const { env, ...rest } = initialDependencies;
    const context: RequestContext = {
        dependencies: { ...rest },
        middlewares: [],
        interceptor: {},
        schemaSQL: [],
        schema: {},
        env,
    };


    if (foundFiles.length === 0) {
        return context;
    }

    

    // Load all found modules in parallel
    const loadedModules = await Promise.all(
        foundFiles.map(file => moduleLoader.load(file.path, true, config)) // contextual modules: not tied to a single request
    );

    // Process the loaded modules sequentially to ensure correct dependency chaining
    for (let i = 0; i < foundFiles.length; i++) {
        const file = foundFiles[i];
        const modules = loadedModules[i];

        if (Object.keys(modules).length === 0) {
            continue;
        }

        const getMatchedPathKey = (modules: Record<string, any>) => {
            return Object.keys(modules)?.find(key => key.startsWith('matchedPath_'));
        }
        const getMatchedPathValue = (modules: Record<string, any>) => {
            const key = getMatchedPathKey(modules);
            return key ? modules[key] as string : undefined;
        }

        switch (file.name) {
            case "dependencies":
                // dependencies modules are factories that augment the dependencies object
                {
                    const matchedPath = getMatchedPathValue(modules);
                    if (modules.default && matchedPath?.split('/').pop()?.includes('dependencies')) {
                        context.dependencies = await modules.default({ ...context.dependencies, env: context.env });
                    }
                }
                break;
            case "shared":
                // Shared modules are factories that augment the dependencies object
                {
                    const matchedPath = getMatchedPathValue(modules);
                    if (modules.default && matchedPath?.split('/').pop()?.includes('shared')) {
                        context.dependencies = await modules.default({ ...context.dependencies, env: context.env });
                        if (context.dependencies.isFactory) {
                            context.isFactory = true;
                            delete context.dependencies.isFactory;
                        } else if (context.dependencies.isBound) {
                            context.isBound = true;
                            delete context.dependencies.isBound;
                        }
                        console.warn('[WARNING] Shared modules are deprecated. Please use `dependencies.ts` or `dependencies.js` instead.');
                    }
                }
                break;
            case "middleware":
                {
                    const matchedPath = getMatchedPathValue(modules);
                    if (modules.default && matchedPath?.split('/').pop()?.includes('middleware')) {
                        context.middlewares.push(modules.default);
                    }
                }
                break;
            case "interceptor":
                // An interceptor module exports beforeRun and/or afterRun directly
                {
                    const matchedPath = getMatchedPathValue(modules);
                    if (matchedPath?.split('/').pop()?.includes('interceptor')) {
                        if (modules.beforeRun) context.interceptor.beforeRun = modules.beforeRun;
                        if (modules.afterRun) context.interceptor.afterRun = modules.afterRun;
                    }
                }
                break;
            case "schema":
                {
                    const matchedPath = getMatchedPathValue(modules);
                    if (matchedPath?.split('/').pop()?.includes('schema')) {
                        if (modules.default && Array.isArray(modules.default)) {
                            context.schemaSQL.push(...modules.default);
                        } else if (modules.default && typeof modules.default === 'object') {
                            context.schema = { ...(context.schema || {}), ...(modules.default as Record<string, any>) };
                        }
                    }
                }
                break;
        }
    }

    return context;
} 