/// <reference lib="deno.unstable" />
import { SEPARATOR, basename, extname, join, dirname } from "https://deno.land/std/path/mod.ts";


self.addEventListener("unhandledrejection", event => {
  // Prevent this being reported (Firefox doesn't currently respect this)
  event.preventDefault();
  console.log(event)

  self.postMessage({
    message: event.reason.message,
    stack: event.reason.stack,
  });
});

import server from "./functions/src/servers/main.ts";
import RequestHandler, { getSubdomain } from "./functions/src/handlers/main.ts";
import Isolate from "./functions/src/isolate/main.ts";
import BearerAuth from "./functions/modules/middlewares/bearerAuth.ts";
import { config } from "https://deno.land/x/dotenv/mod.ts";
let dotEnv;

try {
  dotEnv = config();
} catch (err) {
  console.log(err);
  dotEnv = {};
}

const env = { ...dotEnv, ...Deno.env.toObject() };

(async () => {

  const fileLoaderUrl = new URL(env.FILE_LOADER_URL || "http://localhost:9000");

  Deno.env.get('WATCH') && watchFiles(env);

  server({
    requestHandler: async (req: Request) => {

      const subdomain = getSubdomain(req.url);

      fileLoaderUrl.hostname = [subdomain, fileLoaderUrl.hostname].filter(Boolean).join('.');

      const adapters = await import(join(fileLoaderUrl.href, env.FUNCTIONS_DIR, 'adapters'))
        .then((m: any) => m.default)
        .catch((err: any) => console.log(err)) || ((e: any) => e);

      const configUrl = new URL('axion.config.json', fileLoaderUrl.origin).href;
      
      const config = await fetch(configUrl)
        .then(async (res) => await res.json())
        .catch((err) => console.log(err)) || {};
      return RequestHandler({
        middlewares: {
          "bearerAuth": BearerAuth,
        },
        pipes: {}, // default to no pipes
        modules: {
          path: { SEPARATOR, basename, extname, join, dirname }
        },
        handlers: {
          "/(.*)+": Isolate({
            config: {
              loaderUrl: fileLoaderUrl,
              dirEntrypoint: env.DIR_ENTRYPOINT || "index",
              functionsDir: env.FUNCTIONS_DIR || ".",
              ...config
            },
            modules: {
              path: { SEPARATOR, basename, extname, join, dirname }
            }
          }),
        },
        serializers: {},
        dependencies: {},
        env,
        ...(await adapters(config))
      })(req)
    },
    config: {
      PORT: env.PORT || 9002,
    }
  });
  self.postMessage({ message: { 'status': 'ok' } });
})();

async function watchFiles(env: any) {
  for await (const event of Deno.watchFs("./", { recursive: true })) {
    if (event.kind === "modify" && event.paths.some(path => /\.(html|js|jsx|tsx|ts)$/.test(path))) {
      const dir = Deno.cwd();
      const files = event.paths.map(path => path.split(dir).join(''));
      event.paths.forEach(path => {
        self.postMessage({ message: `Files modified: ${files}` });
      })
    }
  }
}



