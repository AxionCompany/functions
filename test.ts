/// <reference lib="deno.unstable" />

import RequestHandler from "./functions/handlers/main.ts";
import FileLoader from "./functions/features/file-loader/main.ts";
import DynamicImport from "./functions/features/dynamic-import/main.ts";
import BearerAuth from "./functions/middlewares/bearerAuth.ts";

const server = (
  { env, handlers, middlewares, pipes, serializers, dependencies, config }: any,
) => {
  env = { ...env, ...Deno.env.toObject() };
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
    PORT: 8000,
  },
});

(async () => {
  const fileLoaderUrl = Deno.env.toObject().FILE_LOADER_URL ||
    "http://localhost:8000";

  const adapters = await import(`${fileLoaderUrl}/adapters`)
    .then((m: any) => {
      console.log(m);
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
          useIsolate: true,
          // customLoader: CustomLoader({ type: "file", useWorker: false }),
        },
      }),
    },
    serializers: {},
    dependencies: {},
    config: {
      PORT: 8001,
    },
  };

  config = { ...config, ...(await adapters(config)) };

  server(config);
})();
