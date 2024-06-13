/// <reference lib="deno.unstable" />

import RequestHandler from "./functions/src/handlers/main.ts";
import FileLoader from "./functions/src/file-loader/main.ts";
import server from "./functions/src/servers/main.ts";
import { config } from "https://deno.land/x/dotenv/mod.ts";
import { SEPARATOR, basename, extname, join, dirname } from "https://deno.land/std/path/mod.ts";

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
    modules: {
      path: { SEPARATOR, basename, extname, join, dirname }
    },
    handlers: {
      "/(.*)+": FileLoader({
        config: {
          dirEntrypoint: "main",
          loaderType: "local",
        },
        modules: {
          path: {
            SEPARATOR, basename, extname, join, dirname
          }
        }
      }),
    },
    serializers: {},
  }),
  config: {
    PORT: env.FILE_LOADER_PORT || 9000,
    verbose: false
  }
});

self.postMessage({ message: { 'status': 'ok' } });
