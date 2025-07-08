import type { ModuleLoader } from "./loader.ts";
import { findContextualModules } from "./utils/finder.ts";
import type { OxianContext, Handler } from "./types.ts";
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
    config: OxianConfig
): Promise<RequestContext> {

    if (!config.database?.enabled) {
        CONTEXTUAL_MODULE_NAMES.splice(CONTEXTUAL_MODULE_NAMES.indexOf("schema"), 1);
    }
    console.log('CONTEXTUAL_MODULE_NAMES', CONTEXTUAL_MODULE_NAMES)

    const foundFiles = await findContextualModules(importUrl, moduleLoader, CONTEXTUAL_MODULE_NAMES);

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
        foundFiles.map(file => moduleLoader.load(file.path, true)) // bustCache=true to ensure we get a fresh version after probing
    );

    // Process the loaded modules sequentially to ensure correct dependency chaining
    for (let i = 0; i < foundFiles.length; i++) {
        const file = foundFiles[i];
        const modules = loadedModules[i];

        if (Object.keys(modules).length === 0) {
            continue;
        }

        const getMatchedPath = (modules: Record<string, any>) => {
            return Object.keys(modules)?.find(key => key.startsWith('matchedPath_'));
        }

        switch (file.name) {
            case "dependencies":
                // Shared modules are factories that augment the dependencies object
                if (modules.default && getMatchedPath(modules)?.split('/').pop()?.includes('dependencies')) {
                    context.dependencies = await modules.default({ ...context.dependencies, env: context.env });
                }
                break;
            case "shared":
                // Shared modules are factories that augment the dependencies object
                if (modules.default && getMatchedPath(modules)?.split('/').pop()?.includes('shared')) {
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
                break;
            case "middleware":
                if (modules.default && getMatchedPath(modules)?.split('/').pop()?.includes('middleware')) {
                    context.middlewares.push(modules.default);
                }
                break;
            case "interceptor":
                // An interceptor module exports beforeRun and/or afterRun directly
                if ((modules.beforeRun || modules.afterRun) && getMatchedPath(modules)?.split('/').pop()?.includes('interceptor')) {
                    context.interceptor = {
                        ...context.interceptor,
                        beforeRun: modules.beforeRun as Handler || context.interceptor.beforeRun,
                        afterRun: modules.afterRun || context.interceptor.afterRun,
                    };
                }
                break;
            case "schema": {
                // Collect DDL statements
                if (modules.schemaDDL && Array.isArray(modules.schemaDDL)) {
                    context.schemaSQL.push(...modules.schemaDDL);
                }

                // Collect all other exports as the schema
                const schemaExports: Record<string, any> = {};
                Object.keys(modules).forEach((key) => {
                    if (key !== 'schemaDDL' && key !== 'default' && key !== getMatchedPath(modules)) {
                        schemaExports[key] = modules[key];
                    }
                });

                // Also include default export if it exists
                if (modules.default) {
                    Object.assign(schemaExports, modules.default);
                }

                context.dependencies.schema = { ...context.dependencies.schema, ...schemaExports };
                break;
            }
        }
    }

    return context;
} 