import server from "./functions/servers/main.ts";
import RequestHandler from "./functions/handlers/main.ts";

// const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));


(async () => {

    const _adapters = await import(`./adapters.ts`)
        .then((m: any) => m.default)
        .catch((err: any) => console.log(err)) || ((e: any) => e);

    const _config = {
        middlewares: {},
        pipes: {}, // default to no pipes
        handlers: {
            "/(.*)+": async (input: any, response: any) => {
                const { default: _default, GET, POST, PUT, DELETE, ...rest } = await import(input.queryParams.url)
                    .then((m: any) => m)
                    .catch((err: any) => console.log(err)) || ((e: any) => e);
                
                return { default: _default, GET, POST, PUT, DELETE }
            }
        },
        serializers: {},
        dependencies: {},
        config: {},
    };

    const { config, ...adapters }: any = {
        ..._config,
        ...(await _adapters(_config)),
    };

    server({ requestHandler: RequestHandler(adapters), config });
})();
