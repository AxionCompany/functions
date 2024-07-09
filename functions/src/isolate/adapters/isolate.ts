/// <reference lib="deno.unstable" />

import server from "../../servers/main.ts";
import RequestHandler from "../../handlers/main.ts";
import ModuleExecution from "../utils/module-execution.tsx";

const [portString, configString]: string[] = Deno.args || [];
const port = parseInt(portString) || 3000;
const config = JSON.parse(configString);

const isServer = true;
const metaUrl = import.meta.url.split('src')?.[0];
const importAxion: any = (path: string, config: any = {}) => {
    config?.debug && console.log('Importing Axion Module from:', new URL(path, metaUrl).href);
    return import(new URL(path, metaUrl).href);
};

globalThis.metaUrl = metaUrl;
globalThis.importAxion = importAxion;
globalThis.isServer = isServer;


const moduleExecutor = await ModuleExecution(config);


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
