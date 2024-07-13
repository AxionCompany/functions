/// <reference lib="deno.unstable" />
import { SEPARATOR, basename, extname, join, dirname } from "https://deno.land/std/path/mod.ts";

self.addEventListener("unhandledrejection", async event => {
  // Prevent this being reported (Firefox doesn't currently respect this)
  event.preventDefault();
  console.log('API UNHANDLED ERROR', event)

  // clean up isolates
  const cmd = new Deno.Command("./kill_zombie_processes.sh");
  let { code, stdout, stderr } = await cmd.output();
  // stdout & stderr are a Uint8Array
  console.log('AQUII', new TextDecoder().decode(stdout));

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

const env = getEnv();

let configs = new Map<string, string>();
let adapters;

(async () => {

  server({
    requestHandler: async (req: Request) => {
      env.DEBUG === 'true' && console.log('Received request in API from', req.url);

      const fileLoaderUrl = new URL(env.FILE_LOADER_URL || "http://localhost:9000");

      const subdomain = getSubdomain(req.url);

      const subdomainRedirect = env.SUBDOMAIN_REDIRECT === 'true';
      if (subdomainRedirect) {
        fileLoaderUrl.hostname = [subdomain, fileLoaderUrl.hostname].filter(Boolean).join('.');
      }

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

      let config = configs.get(req.url);

      if (!config) {
        config = await fetch(new URL('axion.config.json', fileLoaderUrl).href)
          .then(async (res) => await res.json())
          .catch((_) => null) || {};
        configs.set(req.url, config);
      }

      const isolateExecutor = Isolate({
        config: {
          loaderUrl: fileLoaderUrl.href,
          dirEntrypoint: env.DIR_ENTRYPOINT || "index",
          functionsDir: functionsDir,
          ...config
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



