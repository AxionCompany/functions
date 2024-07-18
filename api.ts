/// <reference lib="deno.unstable" />
import { SEPARATOR, basename, extname, join, dirname } from "https://deno.land/std/path/mod.ts";

self.addEventListener("unhandledrejection", async event => {
  // Prevent this being reported (Firefox doesn't currently respect this)
  event.preventDefault();
  console.log('API UNHANDLED ERROR', event)

  // // clean up isolates
  const cmd = new Deno.Command(`${import.meta.dirname}/kill_zombie_processes.sh`);
  let { code, stdout, stderr } = await cmd.output();

  self.postMessage({
    message: event.reason.message,
    stack: event.reason.stack,
  });

});

import server from "./functions/src/servers/main.ts";
import RequestHandler from "./functions/src/handlers/main.ts";
import { getSubdomain } from "./functions/src/utils/urlFunctions.ts";
import Isolate, { cleanupIsolates } from "./functions/src/isolate/main.ts";
import BearerAuth from "./functions/modules/middlewares/bearerAuth.ts";
import getEnv from "./functions/src/utils/environmentVariables.ts";
import withCache from "./functions/src/utils/withCache.ts";
import axionDenoConfig from "./deno.json" with { type: "json" };

const env = await getEnv();

let axionConfigs = new Map<string, string>();
let denoConfigs = new Map<string, any>();
let adapters;

(async () => {

  server({
    requestHandler: async (req: Request) => {
      env.DEBUG === 'true' && console.log('Received request in API from', req.url);

      const fileLoaderUrl = new URL(env.FILE_LOADER_URL || "http://localhost:9000");
      const { hostname } = new URL(req.url);

      const subdomain = getSubdomain(req.url);

      fileLoaderUrl.username = subdomain;
      fileLoaderUrl.password = env.GIT_API_KEY || '';

      let functionsDir = env.FUNCTIONS_DIR || ".";
      functionsDir.endsWith('/') && (functionsDir = functionsDir.slice(0, -1));

      if (!adapters) {
        adapters = await import(new URL(`${functionsDir}/adapters`, fileLoaderUrl).href)
          .then((m: any) => m.default)
          .catch((err: any) => {
            console.warn(
              `Error trying to load adapters: ${err.toString()}`
                .replaceAll(new URL(functionsDir, fileLoaderUrl).href, '')
            )
          }) || ((a: any) => a);
      }

      let axionConfig = axionConfigs.get(new URL(req.url).origin);

      if (!axionConfig) {
        axionConfig = await fetch(new URL('axion.config.json', fileLoaderUrl).href)
          .then(async (res) => await res.json())
          .catch((_) => null) || {};
        axionConfigs.set(new URL(req.url).origin, axionConfig);
      }

      let denoConfig = denoConfigs.get(new URL(req.url).origin) || {};
      if (!denoConfig) {
        denoConfig = await fetch(new URL('deno.json', fileLoaderUrl).href)
          .then(async (res) => await res.json())
          .catch((_) => null) || {};
        denoConfig.imports = denoConfig?.imports || {};
        denoConfig.scopes = denoConfig?.scopes || {};
        const nodeConfig = await fetch(new URL('package.json', fileLoaderUrl).href)
          .then(async (res) => await res.json())
          .catch((_) => null) || {};
        Object.entries(nodeConfig?.dependencies || {}).map(([key, value]) => {
          if (value.startsWith('http') || value.startsWith('file') || value.startsWith('npm:') || value.startsWith('node:')) {
            denoConfig.imports[key] = value;
          } else {
            denoConfig.imports[key] = `npm:${value}`;
          }
        });
        denoConfigs.set(new URL(req.url).origin, { ...denoConfig });
      };

      denoConfig.imports = { ...axionDenoConfig.imports, ...denoConfig.imports };
      denoConfig.scopes = { ...axionDenoConfig.scopes, ...denoConfig.scopes };

      const isolateExecutor = Isolate({
        config: {
          loaderUrl: fileLoaderUrl.href,
          dirEntrypoint: env.DIR_ENTRYPOINT || "index",
          functionsDir: functionsDir,
          ...axionConfig,
          denoConfig,
        },
        modules: {
          path: { SEPARATOR, basename, extname, join, dirname }
        }
      })

      const handlerConfig = {
        middlewares: {
          "bearerAuth": BearerAuth,
        },
        pipes: {}, // default to no pipes
        modules: {
          path: { SEPARATOR, basename, extname, join, dirname }
        },
        handlers: {
          "/(.*)+": isolateExecutor,
        },
        serializers: {},
        dependencies: {},
        env,
      }

      return RequestHandler({
        handlerConfig,
        ...(await adapters(handlerConfig))
      })(req)
    },
    config: {
      PORT: env.PORT || 9002,
    }
  });
  self.postMessage({ message: { 'status': 'ok' } });
  Deno.env.get('WATCH') && watchFiles(env);
})();

async function watchFiles(env: any) {
  for await (const event of Deno.watchFs("./", { recursive: true })) {
    if (event.kind === "modify" && event.paths.some(path => /\.(html|js|jsx|tsx|ts)$/.test(path))) {
      const dir = Deno.cwd();
      const files = event.paths.map(path => path.split(dir).join(''));
      // clean up isolates
      await cleanupIsolates();
      event.paths.forEach(path => {
        self.postMessage({ message: `Files modified: ${files}` });
      })
    }
  }
}



