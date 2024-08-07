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

globalThis.React = React;
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
    handlers: {
        "/(.*)+": async (data: any, response: any) => {
            try {
                const chunk = await moduleExecutor(data, response);
                return chunk;
            } catch (err) {
                return response.error(err);
            }
        }
    }
};


server({ port, requestHandler: RequestHandler(handlerConfig), config });
