/// <reference lib="deno.unstable" />
import { getSubdomain } from "./functions/src/utils/urlFunctions.ts";
import RequestHandler from "./functions/src/handlers/main.ts";
import FileLoader from "./functions/src/file-loader/main.ts";
import server from "./functions/src/servers/main.ts";
import getEnv from "./functions/src/utils/environmentVariables.ts";
import { SEPARATOR, basename, extname, join, dirname } from "https://deno.land/std/path/mod.ts";
import withCache from "./functions/src/utils/withCache.ts";

self.addEventListener("unhandledrejection", event => {
  // Prevent this being reported (Firefox doesn't currently respect this)
  event.preventDefault();
  console.log('FILE LOADER UNHANDLED ERROR', event)

  // self.postMessage({
  //   message: event.reason.message,
  //   stack: event.reason.stack,
  // });
});


const env = getEnv();

server({
  requestHandler: (req: Request) => {

    const debug = env.DEBUG === 'true';
    debug && console.log('Received request in File Loader from', req.url);
    const url = new URL(req.url);
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
    if (url.hostname === 'localhost') {
      url.hostname = 'example.com';
    }
    const sub = getSubdomain(url.href);

    const [owner, repo, branch, environment] = sub?.split('--') || [];
    const getRepoData = (owner: string, repo: string, branch: string, environment: string) => ({
      owner,
      repo,
      branch,
      environment
    });
    Object.assign(gitInfo, getRepoData(owner, repo, branch, environment));

    debug && console.log('gitInfo', gitInfo)
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
            loaderType: (gitInfo?.owner && gitInfo?.repo) ? 'github' : (env.DEFAULT_LOADER_TYPE || "local"),
            debug,
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
            },
            withCache,
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
