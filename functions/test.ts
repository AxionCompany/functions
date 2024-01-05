/// <reference lib="deno.unstable" />

import RequestHandler from "./handlers/main.ts";
import FileLoader from "./features/file-loader/main.ts";
import DynamicImport from "./features/dynamic-import/main.ts";
import BearerAuth from "./middlewares/bearerAuth.ts";
import { config } from "https://deno.land/x/dotenv/mod.ts";

let dotEnv;

try {
  dotEnv = config();
} catch (err) {
  console.log(err);
  dotEnv = {};
}

const env = {...dotEnv, ...Deno.env.toObject() };

const server = (
  { env, handlers, middlewares, pipes, serializers, dependencies, config }: any,
) => {
  const requestHandler = RequestHandler({
    handlers,
    middlewares,
    pipes,
    serializers,
    dependencies,
    env,
    config,
  });
  const server = Deno.serve(
    { port: config?.PORT || 8000 },
    async (req: Request) => {
      return await requestHandler(req);
    },
  );
  return server.finished;
};

server({
  middlewares: {},
  pipes: {},
  handlers: {
    "/(.*)+": FileLoader({
      config: {
        "functionsDir": "functions",
        "dirEntrypoint": "main",
      },
    }),
  },
  serializers: {},
  config: {
    PORT: env.FILE_LOADER_PORT ||  9000 ,
  },
});

(async () => {
  const fileLoaderUrl = env.FILE_LOADER_URL ||
    "http://localhost:9000";

  const adapters = await import(`${fileLoaderUrl}/adapters`)
    .then((m: any) => {
      return m.default;
    })
    .catch((err: any) => console.log(err));

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
    env
  };

  config = { ...config, ...(await adapters(config)) };

  server(config);
})();
