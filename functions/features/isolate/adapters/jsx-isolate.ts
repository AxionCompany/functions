import server from "../../../servers/main.ts";
import RequestHandler from "../../../handlers/main.ts";
import ModuleExecution from "../utils/module-execution.tsx";
import processCss from "../utils/processCss.ts";
import htmlTemplate from '../utils/html.js';
import ReactDOMServer from "npm:react-dom/server";
import React from "npm:react";

globalThis.React = React

const port: number = parseInt(Deno.args?.[0]) || 3500;

const _config = {
    middlewares: {},
    pipes: {}, // default to no pipes
    handlers: {
        "/(.*)+": async ({ data }: any, response: any) => {
            if (Object.keys(data).length === 1) return
            const { currentUrl, method } = data;
            try {

                if (!data.importUrl) {
                    return response.send('ok');
                }

                const moduleExecutor = ModuleExecution({
                    currentUrl,
                    method,
                    dependencies: {
                        ReactDOMServer,
                        React,
                        htmlTemplate,
                        processCss,
                    },
                });

                const chunk = await moduleExecutor(data, response);
                return response.send(chunk);
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

