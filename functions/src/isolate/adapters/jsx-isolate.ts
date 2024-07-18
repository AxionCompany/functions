import server from "../../servers/main.ts";
import RequestHandler from "../../handlers/main.ts";
import ModuleExecution from "../utils/module-execution.tsx";
import processCss from "../utils/processCss.ts";
import htmlScripts from '../utils/htmlScripts.js';
import ReactDOMServer from "react-dom/server";
import React from "react";
import { DOMParser } from "npm:linkedom";


const [portString, configString, envString]: string[] = Deno.args || [];
const port = parseInt(portString) || 3000;
const config = JSON.parse(configString);
const env = JSON.parse(envString);

for (const key in env) {
    Deno.env.set(key, env[key]);
}

const isServer = true;
const metaUrl = import.meta.url.split('src')?.[0];
const importAxion: any = (path: string, config: any = {}) => {
    config?.debug && console.log('Importing Axion Module from:', new URL(path, metaUrl).href);
    return import(new URL(path, metaUrl).href);
};

globalThis.React = React;
globalThis.metaUrl = metaUrl;
globalThis.importAxion = importAxion;
globalThis.isServer = isServer;


const indexHtml = ` 
<!DOCTYPE html>
<html>
  <head></head>
  <body></body>
</html>
`;

const moduleExecutor = await ModuleExecution({
    ...config,
    metaUrl,
    dependencies: {
        ReactDOMServer,
        React,
        processCss,
        DOMParser,
        htmlScripts,
        indexHtml,
    },
});

const handlerConfig = {
    middlewares: {},
    pipes: {}, // default to no pipes
    handlers: {
        "/(.*)+": async ({ data }: any, response: any) => {

            if (!data) return

            try {

                const chunk = await moduleExecutor(data, response);
                return chunk;
            } catch (err) {
                return response.error(err);
            }
        }
    },
    serializers: {},
    dependencies: {},
};


server({ port, requestHandler: RequestHandler(handlerConfig), config });
