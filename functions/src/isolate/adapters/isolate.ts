/// <reference lib="deno.unstable" />

import server from "../../server/main.ts";
import RequestHandler from "../../handler/main.ts";
import ModuleExecution from "../main.ts";
import Cache from "../../utils/withCache.ts";

const [portString, configString, envString]: string[] = Deno.args || [];
const port = parseInt(portString) || 3000;
const config = JSON.parse(configString);
const env = JSON.parse(envString);

console.log('PATH', Deno.cwd())

const withCache = await Cache(config.projectId);

for (const key in env) {
    Deno.env.set(key, env[key]);
}

const isServer = true;
globalThis.isServer = isServer;

const moduleExecutor = await ModuleExecution({ ...config, dependencies: { withCache } });

const handlerConfig = {
    middlewares: {},
    handlers: {
        "/(.*)+": async function executor(data: any, response: any) {
            try {
                const chunk = await moduleExecutor(data, response);
                return chunk;
            } catch (err) {
                return response.error(err);
            }
        }
    },
};

server({ port, requestHandler: RequestHandler(handlerConfig), config });
