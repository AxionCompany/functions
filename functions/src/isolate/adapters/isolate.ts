/// <reference lib="deno.unstable" />

import server from "../../servers/main.ts";
import RequestHandler from "../../handlers/main.ts";
import ModuleExecution from "../utils/module-execution.tsx";

const port: number = parseInt(Deno.args?.[0]) || 3000;

let metaUrl = import.meta.url.split('src')?.[0]
const importAxion: any = (path: string) => {
  console.log('Importing Axion Module from:', new URL(path, metaUrl).href);
  return import(new URL(path, metaUrl).href);
}
globalThis.importAxion = importAxion;

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

                const moduleExecutor = ModuleExecution({ currentUrl, method, metaUrl });
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
