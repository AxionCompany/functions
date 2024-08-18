import server from "../../server/main.ts";
import RequestHandler from "../../handler/main.ts";
import ModuleExecution from "../main.ts";
import processCss from "../utils/processCss.ts";
import htmlScripts from '../utils/htmlScripts.js';
import ReactDOMServer from "react-dom/server";
import React from "react";
import { DOMParser } from "npm:linkedom";
import Cache from "../../utils/withCache.ts";

const [portString, configString]: string[] = Deno.args || [];
const port = parseInt(portString) || 3000;
const config = JSON.parse(configString);


const withCache = await Cache(config.projectId);

const isServer = true;

globalThis.React = React;
globalThis.isServer = isServer;


const indexHtml = ` 
<!DOCTYPE html>
<html>
  <head></head>
  <body></body>
</html>
`;

const moduleExecutors = new Map<string, any>();


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
            if (moduleExecutors.has(importUrl)) {
                moduleExecutor = moduleExecutors.get(importUrl);
            } else {
                moduleExecutor = await ModuleExecution({
                    ...config,
                    importUrl,
                    dependencies: {
                        ReactDOMServer,
                        React,
                        processCss,
                        DOMParser,
                        htmlScripts,
                        indexHtml,
                        withCache
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
