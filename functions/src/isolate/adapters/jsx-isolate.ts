import server from "../../servers/main.ts";
import RequestHandler from "../../handlers/main.ts";
import ModuleExecution from "../utils/module-execution.tsx";
import processCss from "../utils/processCss.ts";
import htmlScripts from '../utils/htmlScripts.js';
import ReactDOMServer from "npm:react-dom/server";
import React from "npm:react";
import { DOMParser } from "npm:linkedom";


const isServer = true;
const metaUrl = import.meta.url.split('src')?.[0];
const importAxion: any = (path: string) => {
    console.log('Importing Axion Module from:', new URL(path, metaUrl).href);
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

const port: number = parseInt(Deno.args?.[0]) || 3500;

const _config = {
    middlewares: {},
    pipes: {}, // default to no pipes
    handlers: {
        "/(.*)+": async ({ data }: any, response: any) => {

            if (!data) return

            const { currentUrl, method, functionsDir, dirEntrypoint } = data;

            try {

                if (!data.importUrl) {
                    return response.send('ok');
                }

                const moduleExecutor = ModuleExecution({
                    currentUrl,
                    metaUrl,
                    method,
                    functionsDir,
                    dirEntrypoint,
                    dependencies: {
                        ReactDOMServer,
                        React,
                        processCss,
                        DOMParser,
                        htmlScripts,
                        indexHtml,
                    },
                });

                const chunk = await moduleExecutor(data, response);
                return chunk;
            } catch (err) {
                response.error(err);
            }
        }
    },
    serializers: {},
    dependencies: {},
    config: {},
};

const { config, ...adapters }: any = _config

server({ port, requestHandler: RequestHandler(adapters), config });
