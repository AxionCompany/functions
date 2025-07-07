import server from "../../server/main.ts";
import RequestHandler from "../../handler/main.ts";
import ModuleExecution from "../main.ts";
import Cache from "../../utils/withCache.ts";
import { installSourceMapSupport } from "../utils/sourceMapSupport.ts";
import { withDatabase, cleanupDatabase, DatabaseDependencies } from "../utils/withDatabase.ts";
// import { context } from "npm:@opentelemetry/api@1"

// Extend globalThis interface for type safety
declare global {
  var isServer: boolean;
  var isolateType: string;
}

// globalThis.context = context;

// Install source map support for better debugging
installSourceMapSupport();

let port: number | undefined;
let config: any;
let dependencies: DatabaseDependencies | null = null;

const moduleExecutors = new Map<string, any>();
let cachePathPrefix = '';

const [portString, configString]: string[] = Deno?.args || [];
if (portString && configString) {
    port = parseInt(portString) || 3000;
    config = JSON.parse(configString || '{}');
} else {
    // @ts-ignore: self is defined in worker environments
    self.onmessage = function (event: any) {
        const { port: _port, ..._config } = event.data;
        port = _port;
        config = _config;
        cachePathPrefix = config.projectPath;
    };
}
// await for port and config
while (true) {
    if (port && config) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
}

// Set global variables with proper typing
globalThis.isServer = true;
globalThis.isolateType = 'regular';

const withCache = (await Cache(config.projectId, cachePathPrefix));

// Graceful shutdown handler
const cleanup = async () => {
    console.log('Isolate shutting down, cleaning up resources...');
    if (dependencies) {
        await cleanupDatabase(dependencies);
    }
};

// Handle shutdown signals
if (typeof Deno !== 'undefined') {
    Deno.addSignalListener("SIGTERM", cleanup);
    Deno.addSignalListener("SIGINT", cleanup);
}

// Handle worker termination
if (typeof self !== 'undefined') {
    self.addEventListener("beforeunload", cleanup);
}

const handlerConfig = {
    middlewares: {},
    handlers: {
        "/(.*)+": async function executor(data: any, response: any) {
            try {
                // If the request is a health check, return "ok"         
                const pathname = new URL(data.url).pathname;
                if (pathname === "/__healthcheck__") {
                    return "ok";
                }

                // If the request is not a health check, execute the module
                let moduleExecutor;
                const queryParams = Object.fromEntries(new URL(data.url).searchParams.entries());
                const importUrl = atob(queryParams.__importUrl__);
                const url = atob(queryParams.__proxyUrl__);
                
                const isJSX = queryParams.__isJSX__ === 'true';
                data.url = url;
                if (isJSX) {
                    throw new Error(`Isolate of type "${globalThis.isolateType}" is not compatible with JSX modules`);
                }
                
                // Check if we should bust the cache for this module
                const bustCache = config.bustCache || false;
                
                if (moduleExecutors.has(importUrl) && !bustCache) {
                    console.log('Module already loaded:', importUrl);
                    moduleExecutor = moduleExecutors.get(importUrl);
                } else {
                    if (bustCache && moduleExecutors.has(importUrl)) {
                        console.log('Busting cache and reloading module:', importUrl);
                        moduleExecutors.delete(importUrl);
                    } else {
                        console.log('Loading module:', importUrl);
                    }
                    
                    const databaseDependencies = await withDatabase(dependencies || { withCache }, {
                        database: config.database,
                        projectPath: config.projectPath || Deno.cwd(),
                        isolateId: config.isolateId || 'default',
                        loaderUrl: config.env?.IMPORT_URL ? new URL(config.env.IMPORT_URL).origin : undefined
                    })
                    
                    dependencies = databaseDependencies

                    moduleExecutor = await ModuleExecution({ 
                        ...config, 
                        isJSX, 
                        importUrl, 
                        url, 
                        dependencies: databaseDependencies
                    });
                    moduleExecutors.set(importUrl, moduleExecutor);
                }
                const chunk = await moduleExecutor(data, response);
                return chunk;
            } catch (err) {
                return response.error(err);
            }
        }
    },
};

server({ port, requestHandler: RequestHandler(handlerConfig), config });