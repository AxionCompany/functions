/// <reference lib="deno.unstable" />

import server from "../../server/main.ts";
import RequestHandler from "../../handler/main.ts";
import ModuleExecution from "../main.ts";
import Cache from "../../utils/withCache.ts";

let port: number;
let config: any;
let transportType: 'http' | 'nats' | 'worker';

const moduleExecutors = new Map<string, any>();
let cachePathPrefix = '';

// Handle different initialization methods based on transport type
if (Deno?.args?.length) {
    const [portString, configString]: string[] = Deno.args;
    port = parseInt(portString) || 3000;
    config = JSON.parse(configString || '{}');
    transportType = 'http';
    Deno.cwd = () => config.projectPath;
} else {
    self.onmessage = function (event: any) {
        const { port: _port, ..._config } = event.data;
        port = _port;
        config = _config;
        transportType = 'worker';
        cachePathPrefix = config.projectPath;
        Deno.cwd = () => config.projectPath;
    };
}

// NATS subscription setup
if (config?.natsUrl) {
    transportType = 'nats';
    const nc = await connect({ servers: config.natsUrl });
    const sub = nc.subscribe(`isolate.${config.isolateId}`);
    (async () => {
        for await (const msg of sub) {
            const data = JSON.parse(new TextDecoder().decode(msg.data));
            try {
                const response = await handleRequest(data);
                msg.respond(new TextEncoder().encode(JSON.stringify({
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries()),
                    body: await response.text()
                })));
            } catch (error) {
                msg.respond(new TextEncoder().encode(JSON.stringify({
                    status: 500,
                    statusText: 'Internal Server Error',
                    body: error.message
                })));
            }
        }
    })();
}

// await for configuration
while (true) {
    if ((port && config) || transportType === 'nats') break;
    await new Promise((resolve) => setTimeout(resolve, 100));
}

const isServer = true;
globalThis.isServer = isServer;
globalThis.isolateType = 'regular';

const withCache = (await Cache(config.projectId, cachePathPrefix));

async function handleRequest(data: any) {
    try {
        if (data.pathname === "/__healthcheck__") {
            return new Response("ok");
        }

        let moduleExecutor;
        const queryParams = Object.fromEntries(new URLSearchParams(data.search).entries());
        const importUrl = atob(queryParams.__importUrl__);
        const url = atob(queryParams.__proxyUrl__);
        const isJSX = queryParams.__isJSX__ === 'true';
        data.url = url;

        if (isJSX) {
            throw new Error(`Isolate of type "${globalThis.isolateType}" is not compatible with JSX modules`);
        }

        if (moduleExecutors.has(importUrl)) {
            moduleExecutor = moduleExecutors.get(importUrl);
        } else {
            moduleExecutor = await ModuleExecution({ 
                ...config, 
                isJSX, 
                importUrl, 
                url, 
                dependencies: { withCache } 
            });
            moduleExecutors.set(importUrl, moduleExecutor);
        }

        return await moduleExecutor(data);
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Only start HTTP server if using HTTP transport
if (transportType === 'http') {
    const handlerConfig = {
        handlers: {
            "/(.*)+": handleRequest
        }
    };

    server({ port, requestHandler: RequestHandler(handlerConfig), config });
} else if (transportType === 'worker') {
    // Worker message handling
    self.onmessage = async function(event: MessageEvent) {
        try {
            const response = await handleRequest(event.data);
            const responseData = {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries()),
                body: await response.text()
            };
            self.postMessage(responseData);
        } catch (error) {
            self.postMessage({
                status: 500,
                statusText: 'Internal Server Error',
                body: error.message
            });
        }
    };
}
