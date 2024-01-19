/// <reference lib="deno.unstable" />

import RequestHandler from "./functions/handlers/main.ts";
import FileLoader from "./functions/features/file-loader/main.ts";
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
          functionsDir: env.FUNCTIONS_DIR || ".",
          dirEntrypoint: "main",
          loaderType: "local",
          //   loaderType: "github",
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
