/// <reference lib="deno.unstable" />

import server from "../../server/main.ts";
import RequestHandler from "../../handler/main.ts";
import ModuleExecution from "../main.ts";
import Cache from "../../utils/withCache.ts";

let port: number;
let config: any;

const moduleExecutors = new Map<string, any>();
let cachePathPrefix = '';

const [portString, configString]: string[] = Deno?.args || [];
if (portString && configString) {
    port = parseInt(portString) || 3000;
    config = JSON.parse(configString || '{}');
} else {
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

const isServer = true;
globalThis.isServer = isServer;
globalThis.isolateType = 'regular';

const withCache = (await Cache(config.projectId, cachePathPrefix));

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
                if (moduleExecutors.has(importUrl)) {
                    console.log('Module already loaded:', importUrl);
                    moduleExecutor = moduleExecutors.get(importUrl);
                } else {
                    console.log('Loading module:', importUrl);
                    moduleExecutor = await ModuleExecution({ ...config, isJSX, importUrl, url, dependencies: { withCache } });
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
