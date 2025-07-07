/// <reference lib="deno.worker" />

import server from "../server/main.ts";
import RequestHandler from "../handler/main.ts";
import { ModuleExecutor } from "./execution.ts";
import Cache from "../utils/withCache.ts";

// Set up global context for the isolate
declare global {
  var isServer: boolean;
  var isolateType: string;
}

globalThis.isServer = true;
globalThis.isolateType = 'v2-backend-only';

async function main() {
  let port: number | undefined;
  let config: any;

  // 1. Configuration loading (from args or message)
  if (Deno?.args.length >= 2) {
    const [portString, configString] = Deno.args;
    port = parseInt(portString, 10);
    config = JSON.parse(configString);
  } else if (typeof self !== 'undefined') {
    // Running as a worker
    self.onmessage = (event: MessageEvent) => {
      const { port: _port, ..._config } = event.data;
      port = _port;
      config = _config;
    };
  }

  // Wait until configuration is received
  while (!port || !config) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // 2. Initialize dependencies
  const withCache = await Cache(config.projectId, config.projectPath);
  const moduleExecutor = new ModuleExecutor({ config, withCache });

  // 3. Setup Request Handler
  const handlerConfig = {
    handlers: {
      "/(.*)+": async (data: any, response: any) => {

        try {
          const url = new URL(data.url);
          if (url.pathname === "/__healthcheck__") {
            return "ok";
          }
          
          return await moduleExecutor.execute(data, response);

        } catch (err) {
          console.error("[IsolateV2] Request execution error:", err);
          return response.error(err);
        }
      },
    },
  };

  // 4. Start the server
  console.log(`[IsolateV2] Starting server on port ${port}`);
  server({ port, requestHandler: RequestHandler(handlerConfig), config });
}

main().catch(err => {
    console.error("[IsolateV2] Critical error during startup:", err);
    // In a worker context, we might need to notify the parent
    if (typeof self !== 'undefined') {
        self.postMessage({ error: 'critical_startup_failure' });
    }
    Deno.exit(1);
}); 