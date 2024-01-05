/// <reference lib="deno.unstable" />

import RequestHandler from "./functions/handlers/main.ts";
import FileLoader from "./functions/features/file-loader/main.ts";
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

server({
  requestHandler: RequestHandler({
    middlewares: {},
    pipes: {},
    handlers: {
      "/(.*)+": FileLoader({
        config: {
          functionsDir: "functions",
          dirEntrypoint: "main",
          loaderType: "github",
          gitOwner: "AxionCompany",
          gitRepo: "functions",
          gitToken: env.GIT_TOKEN,
          gitRef: "homolog",
        },
      }),
    },
    serializers: {},
  }),
  config: {
    PORT: env.FILE_LOADER_PORT || 9000,
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
    env,
  };

  const { config: _config, ..._adapters }: any = {
    ...config,
    ...(await adapters(config)),
  };

  server({ requestHandler: RequestHandler(_adapters), config: _config });
})();
