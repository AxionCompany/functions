/// <reference lib="deno.unstable" />

import server from "../../../servers/main.ts";
import RequestHandler from "../../../handlers/main.ts";
import ModuleExecution from "../utils/module-execution.tsx";

// Flag to check if overrides have been applied
let overridesApplied = false;

const checkOrCreateDir = async (path: string) => {
    try {
        await Deno.stat(path);
    } catch (err) {
        if (err instanceof Deno.errors.NotFound) {
            await Deno.mkdir(path, { recursive: true });
        }
    }
};

const port: number = parseInt(Deno.args?.[0]) || 3000;

// const denoOverrides: any = {
//     "openKv": ({ currentUrl, originalModule, ...rest }: {
//         currentUrl: string;
//         originalModule: any;
//     }) => async (data: any) => {
//         try {
//             console.log('currentUrl', currentUrl)
//             const basePath = new URL(currentUrl).pathname.split("/").filter(Boolean)[0];
//             const kvDir = `data/${basePath}`;
//             await checkOrCreateDir(kvDir);
//             return originalModule(kvDir + '/kv');
//         } catch (err) {
//             console.log('err in open Deno kv ', err)
//             return originalModule(data)
//         }
//     },
// };

const _config = {
    middlewares: {},
    pipes: {}, // default to no pipes
    handlers: {
        "/(.*)+": async ({ data }: any, response: any) => {
            if (Object.keys(data).length === 1) return
            const { currentUrl, method } = data;
            console.log('DATA >>>>', data)

            try {
                // Apply overrides only once
                // if (!overridesApplied) {
                //     Object.keys(globalThis.Deno).forEach((key) => {
                //         const originalModule = globalThis.Deno[key];
                //         if (denoOverrides[key]) {
                //             globalThis.Deno[key] = denoOverrides[key]({
                //                 currentUrl,
                //                 originalModule,
                //             });
                //         }
                //     });
                //     overridesApplied = true; // Set the flag to true after applying overrides
                // }

                if (!data.importUrl) {
                    return response.send('ok');
                }

                const moduleExecutor = ModuleExecution({ currentUrl, method });
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
