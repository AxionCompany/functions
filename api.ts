/// <reference lib="deno.unstable" />

self.addEventListener("unhandledrejection", event => {
  // Prevent this being reported (Firefox doesn't currently respect this)
  event.preventDefault();

  self.postMessage({
    message: event.reason.message,
    stack: event.reason.stack,
  });
});


import RequestHandler from "./functions/handlers/main.ts";
import DynamicImport from "./functions/features/dynamic-import/main.ts";
import BearerAuth from "./functions/middlewares/bearerAuth.ts";
import server from "./functions/servers/main.ts";
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
  const fileLoaderUrl = env.FILE_LOADER_URL ||
    "http://localhost:9000";

  const adapters = await import(`${fileLoaderUrl}/adapters`)
    .then((m: any) => {
      return m.default;
    })
    .catch((err: any) => console.log(err)) || ((e: any) => e);

  let config = {
    middlewares: {
      "bearerAuth": BearerAuth,
    },
    pipes: {}, // default to no pipes
    handlers: {
      "/(.*)+": DynamicImport({
        config: {
          loaderUrl: fileLoaderUrl,
          useWebWorker: true,
          // loader: CustomLoader({ type: "file", useWorker: false }),
        },
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

  server({ requestHandler: RequestHandler(_adapters), config: _config });
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



