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
  requestHandler: (req: Request) => {
    const urlParts = new URL(req.url).host.split('.');
    const gitInfo = {}
    if (urlParts.length > 2 || urlParts[1]?.includes('localhost')) {
      const [owner, repo, branch] = urlParts[0]?.split('--') || [];
      const getRepoData = (owner: string, repo: string, branch: string) => ({
        owner,
        repo,
        branch
      });
      Object.assign(gitInfo, getRepoData(owner, repo, branch));
    }
    return RequestHandler({
      middlewares: {},
      pipes: {},
      modules: {
        path: { SEPARATOR, basename, extname, join, dirname }
      },
      handlers: {
        "/(.*)+": FileLoader({
          config: {
            dirEntrypoint: env.DIR_ENTRYPOINT || "main",
            loaderType: env.DEFAULT_LOADER_TYPE || "local",
            cachettl: env.CACHE_TTL || 1000 * 60 * 10,
            owner: gitInfo?.owner || "AxionCompany",
            repo: gitInfo?.repo || "functions",
            branch: gitInfo?.branch || "develop", // or any other branch you want to fetch files froM
            apiKey: env.GIT_API_KEY
          },
          modules: {
            path: {
              SEPARATOR, basename, extname, join, dirname
            }
          }
        }),
      },
      serializers: {},
    })(req)
  },
  config: {
    PORT: env.FILE_LOADER_PORT || 9000,
    verbose: false
  }
});

self.postMessage({ message: { 'status': 'ok' } });
