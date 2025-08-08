/// <reference lib="deno.worker" />

import server from "../server/main.ts";
import RequestHandler from "../handler/main.ts";
import { ModuleExecutor } from "./execution.ts";
import Cache from "../utils/withCache.ts";
import type { IsolateConfig } from "./types.ts";

// Set up global context for the isolate
declare global {
  var isServer: boolean;
  var isolateType: string;
}

async function main() {
  let port: number | undefined;
  let config: IsolateConfig | undefined;

  // 1. Configuration loading (from args, message, or environment)
  if (Deno?.args.length >= 2) {
    const [portString, configString] = Deno.args;
    port = parseInt(portString, 10);
    config = JSON.parse(configString);
  } else if (self?.onmessage) {
    // Running as a worker
    self.onmessage = (event: MessageEvent) => {
      const { port: _port, ..._config } = event.data;
      port = _port;
      config = _config;
    };
  } else {
    // Running directly - load from environment variables
    port = parseInt(Deno.env.get('PORT') || '9000', 10);
    config = {
      projectId: Deno.env.get('PROJECT_ID') || 'default',
      projectPath: Deno.env.get('PROJECT_PATH') || Deno.cwd(),
      isolateId: Deno.env.get('ISOLATE_ID') || 'default',
      env: Object.fromEntries(
        Object.entries(Deno.env.toObject()).filter(([key]) => 
          !['PORT', 'PROJECT_ID', 'PROJECT_PATH', 'ISOLATE_ID'].includes(key)
        )
      ),
      importUrl: Deno.env.get('IMPORT_URL') || Deno.env.get('IMPORT_PATH'),
      loaderUrl: Deno.env.get('LOADER_URL'),
      database: {
        enabled: Deno.env.get('DATABASE_ENABLED') === 'true',
        remoteURL: Deno.env.get('DATABASE_URL'),
        lwwColumn: Deno.env.get('DATABASE_LWW_COLUMN') || 'updated_at',
        edgeId: Deno.env.get('DATABASE_EDGE_ID'),
      },
      fileLoader: {
        loaderType: Deno.env.get('FILE_LOADER_TYPE') || 'local',
        debug: Deno.env.get('FILE_LOADER_DEBUG') === 'true',
        useCache: Deno.env.get('FILE_LOADER_USE_CACHE') !== 'false',
        bustCache: Deno.env.get('FILE_LOADER_BUST_CACHE') === 'true',
        environment: Deno.env.get('FILE_LOADER_ENVIRONMENT'),
        dirEntrypoint: Deno.env.get('FILE_LOADER_DIR_ENTRYPOINT') || 'index',
      },
      functionsDir: Deno.env.get('FUNCTIONS_DIR') || Deno.env.get('OXIAN_FUNCTIONS_DIR') || `functions`,
      denoConfig: {
        imports: Deno.env.get('DENO_IMPORTS') ? JSON.parse(Deno.env.get('DENO_IMPORTS')!) : undefined,
        scopes: Deno.env.get('DENO_SCOPES') ? JSON.parse(Deno.env.get('DENO_SCOPES')!) : undefined,
      },
    };
  }

  // Wait until configuration is received (only for worker mode)
  if (typeof self !== 'undefined') {
    while (!port || !config) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  // At this point, config is guaranteed to be defined
  const finalConfig = config!;

  // 2. Initialize dependencies
  const withCache = await Cache(finalConfig.projectId, finalConfig.projectPath);
  const moduleExecutor = new ModuleExecutor({ config: finalConfig, withCache });

  // Development hot reload: bust cache on file changes when WATCH is true
  if ((finalConfig.env?.WATCH === 'true' || Deno.env.get('WATCH') === 'true') && finalConfig.projectPath) {
    (async () => {
      try {
        for await (const evt of Deno.watchFs(finalConfig.projectPath, { recursive: true })) {
          if (evt.kind === 'modify' && evt.paths.some(p => /\.(ts|tsx|js|jsx|json|html)$/.test(p))) {
            // Toggle bustCache flag to force rebuilds on next bundle
            moduleExecutor["config"].bustCache = true;
          }
        }
      } catch {
        // ignore watcher errors in environments without FS access
      }
    })();
  }

  // 3. Setup Request Handler
  const handlerConfig = {
    handlers: {
      "/(.*)+": async (data: any, response: any) => {

        try {
          const url = new URL(data.url);
          if (url.pathname === "/__healthcheck__") {
            return "ok";
          }
          if (url.pathname === "/__reload__") {
            moduleExecutor["config"].bustCache = true;
            return { reloaded: true };
          }
          
          return await moduleExecutor.execute(data, response);

        } catch (err) {
          const e = err as any;
          if (e?.stack && typeof e.stack === 'string') {
            console.error(e.stack);
          } else {
            console.error("[IsolateV2] Request execution error:", e?.message || e);
          }
          return response.error(err);
        }
      },
    },
  };

  // 4. Start the server
  console.log(`[Isolate] Starting server on port ${port}`);
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