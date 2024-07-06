/// <reference lib="deno.unstable" />

import RequestHandler, { getSubdomain } from "./functions/src/handlers/main.ts";
import FileLoader from "./functions/src/file-loader/main.ts";
import server from "./functions/src/servers/main.ts";
import getEnv from "./functions/src/utils/environmentVariables.ts";
import { SEPARATOR, basename, extname, join, dirname } from "https://deno.land/std/path/mod.ts";

const env = getEnv();

server({
  requestHandler: (req: Request) => {
    let useCache;
    try {
      useCache = JSON.parse(env.USE_CACHE || 'true');
    } catch (err) {
      useCache = true;
    }
    const gitInfo: {
      owner?: string,
      repo?: string,
      branch?: string,
      environment?: string
    } = {}
    const sub = getSubdomain(req.url)
    const [owner, repo, branch, environment] = sub?.split('--') || [];
    const getRepoData = (owner: string, repo: string, branch: string, environment: string) => ({
      owner,
      repo,
      branch,
      environment
    });
    Object.assign(gitInfo, getRepoData(owner, repo, branch, environment));
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
            loaderType: (gitInfo?.owner && gitInfo?.repo && gitInfo?.branch) ? 'github' : (env.DEFAULT_LOADER_TYPE || "local"),
            debug: env.DEBUG === 'true',
            useCache,
            cachettl: Number(env.CACHE_TTL) || 1000 * 60 * 10,
            owner: gitInfo?.owner || env.GIT_OWNER,
            repo: gitInfo?.repo || env.GIT_REPO,
            branch: gitInfo?.branch || env.GIT_BRANCH, // or any other branch you want to fetch files froM
            environment: gitInfo?.environment || env.ENV,
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
