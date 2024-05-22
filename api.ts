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


import server from "./functions/servers/main.ts";
import RequestHandler from "./functions/handlers/main.ts";
import Isolate from "./functions/features/isolate/main.ts";
import FileLoader from "./functions/features/file-loader/main.ts";
import BearerAuth from "./functions/middlewares/bearerAuth.ts";
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

  const fileLoaderUrl = env.FILE_LOADER_URL
    || "http://localhost:9000";

  console.log(join(fileLoaderUrl, env.FUNCTIONS_DIR, 'adapters'))

  const adapters = await import(join(fileLoaderUrl, env.FUNCTIONS_DIR, 'adapters'))
    .then((m: any) => m.default)
    .catch((err: any) => console.log(err)) || ((e: any) => e);

  let config = {
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
          functionsDir: env.FUNCTIONS_DIR || ".",
        },
        modules: {
          path: { SEPARATOR, basename, extname, join, dirname }
        }
      }),
    },
    serializers: {},
    dependencies: {},
    config: {
      PORT: env.PORT || 9002,
    },
    env,
  };

  const { config: _config, ..._adapters }: any = {
    ...config,
    ...(await adapters(config)),
  };

  Deno.env.get('WATCH') && watchFiles(env);

  server({ requestHandler: RequestHandler({ ..._config, ..._adapters }), config: _config });
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



