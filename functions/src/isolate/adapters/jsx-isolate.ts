import server from "../../server/main.ts";
import RequestHandler from "../../handler/main.ts";
import ModuleExecution from "../main.ts";
import processCss from "../utils/processCss.ts";
import htmlScripts from '../utils/htmlScripts.js';
import ReactDOMServer from "npm:react-dom/server";
import React from "npm:react";
import { DOMParser } from "npm:linkedom";
import Cache from "../../utils/withCache.ts";

let port: number;
let config: any;


const moduleExecutors = new Map<string, any>();
let cachePathPrefix = '';

const [portString, configString]: string[] = Deno?.args || [];
if (portString && configString) {
    port = parseInt(portString) || 3000;
    config = JSON.parse(configString || '{}');
    Deno.cwd = () => config.projectPath;
} else {
    self.onmessage = function (event: any) {
        const { port: _port, ..._config } = event.data;
        port = _port;
        config = _config;
        cachePathPrefix = config.projectPath;
        Deno.cwd = () => config.projectPath;
    };
}

// await for port and config
while (true) {
    if (port && config) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
}

const isServer = true;
globalThis.React = React;
globalThis.isServer = isServer;
globalThis.isolateType = 'jsx';


const withCache = (await Cache(config.projectId, cachePathPrefix));


const indexHtml = ` 
<!DOCTYPE html>
<html>
  <head></head>
  <body></body>
</html>
`;

// const moduleExecutors = new Map<string, any>();


const handlerConfig = {
    handlers: {
        "/(.*)+": async (data: any, response: any) => {

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
                if (moduleExecutors.has(importUrl)) {
                    moduleExecutor = moduleExecutors.get(importUrl);
                } else {
                    moduleExecutor = await ModuleExecution({
                        ...config,
                        isJSX,
                        importUrl,
                        url,
                        dependencies: {
                            ReactDOMServer,
                            React,
                            processCss,
                            DOMParser,
                            htmlScripts,
                            indexHtml,
                            withCache,
                        },
                    });
                    moduleExecutors.set(importUrl, moduleExecutor);
                }
                const chunk = await moduleExecutor(data, response);
                return chunk;
            } catch (err) {
                return response.error(err);
            }
        }
    }
};


server({ port, requestHandler: RequestHandler(handlerConfig), config });