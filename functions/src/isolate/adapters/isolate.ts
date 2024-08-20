/// <reference lib="deno.unstable" />

import server from "../../server/main.ts";
import RequestHandler from "../../handler/main.ts";
import ModuleExecution from "../main.ts";
import Cache from "../../utils/withCache.ts";

const [portString, configString]: string[] = Deno.args || [];
const port = parseInt(portString) || 3000;
const config = JSON.parse(configString);

const withCache = await Cache(config.projectId);

const isServer = true;
globalThis.isServer = isServer;
globalThis.isolateType = 'regular';

const moduleExecutors = new Map<string, any>();

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
                const isJSX = queryParams.__isJSX__ === 'true';
                if (isJSX) {
                    throw new Error(`Isolate of type "${globalThis.isolateType}" is not compatible with JSX modules`);
                  }
                if (moduleExecutors.has(importUrl)) {
                    console.log('Module already loaded:', importUrl);
                    moduleExecutor = moduleExecutors.get(importUrl);
                } else {
                    console.log('Loading module:', importUrl);
                    moduleExecutor = await ModuleExecution({ ...config, isJSX, importUrl, dependencies: { withCache } });
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
