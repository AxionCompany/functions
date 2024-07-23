/// <reference lib="deno.unstable" />
import RequestHandler from "./functions/src/handlers/main.ts";
import FileLoader from "./functions/src/file-loader/main.ts";
import server from "./functions/src/servers/main.ts";
import getEnv from "./functions/src/utils/environmentVariables.ts";
import { SEPARATOR, basename, extname, join, dirname } from "https://deno.land/std/path/mod.ts";
import withCache from "./functions/src/utils/withCache.ts";
import denoConfig from "./deno.json" with { type: "json" };

self?.addEventListener("unhandledrejection", event => {
  event.preventDefault();
  console.log('FILE LOADER UNHANDLED ERROR', event)

  // self.postMessage({
  //   message: event.reason.message,
  //   stack: event.reason.stack,
  // });
});

let axionConfigs = new Map<string, string>();
let denoConfigs = new Map<string, any>();

const env = await getEnv();

server({
  requestHandler: async (req: Request) => {
    const debug = env.DEBUG === 'true';
    const url = new URL(req.url);
    let useCache;
    const authorizationEncoded = req.headers.get('authorization')?.slice(6);
    const [username, password] = authorizationEncoded ? atob(authorizationEncoded).split(':') : [];
    debug && console.log('Received request in File Loader from', req.url);

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
    } = {};

    // const sub = username && getSubdomain(username);
    const [owner, repo, branch, environment] = username?.split('--') || [];
    const getRepoData = (owner: string, repo: string, branch: string, environment: string) => ({
      owner,
      repo,
      branch,
      environment
    });
    Object.assign(gitInfo, getRepoData(owner, repo, branch, environment));

    debug && console.log('gitInfo', gitInfo)

    const fileLoaderWithAxionConfig = async ({ config, modules }) => async (params, res) => {

      const axionConfigUrl = new URL('/axion.config.json', params.url);
      const denoConfigUrl = new URL('/deno.json', params.url);

      username && (axionConfigUrl.username = username);
      password && (axionConfigUrl.password = password);

      let axionConfig = axionConfigs.get(axionConfigUrl.href);
      let _denoConfig = denoConfigs.get(denoConfigUrl.href);

      const responseMock = Object.entries(res).reduce((acc, [key, value]) => {
        acc[key] = (() => { });
        return acc;
      }, {})

      const fileLoader =  FileLoader({ config, modules });

      if (!axionConfig) {
        console.log('axion.config.json not found in cache for', axionConfigUrl.href, 'fetching from server...')
        axionConfig = await fileLoader({
          queryParams: {},
          headers: { 'content-type': 'text/plain' },
          pathname: axionConfigUrl.pathname,
          url: axionConfigUrl,
        }, responseMock);

        axionConfig = JSON.parse(axionConfig || '{}')
        axionConfigs.set(axionConfigUrl.href, axionConfig);
      }

      if (!_denoConfig) {
        console.log('deno.json not found in cache for', axionConfigUrl.href, 'fetching from server...')
        _denoConfig = await fileLoader({
          queryParams: {},
          headers: { 'content-type': 'text/plain' },
          pathname: '/deno.json',
          url: axionConfigUrl,
        }, responseMock);

        _denoConfig = JSON.parse(_denoConfig || '{}')
        const nodeConfig = await fileLoader({
          queryParams: {},
          headers: { 'content-type': 'text/plain' },
          pathname: '/package.json',
          url: axionConfigUrl,
        }, responseMock);
        const nodeConfigJson = JSON.parse(nodeConfig || '{}');
        Object.entries(nodeConfigJson?.dependencies || {}).forEach(([key, value]) => {
          if (value.startsWith('http') || value.startsWith('file') || value.startsWith('npm:') || value.startsWith('node:')) {
            _denoConfig.imports[key] = value;
          } else {
            _denoConfig.imports[key] = `npm:${key}@${value}`;
          }
        });
        denoConfigs.set(denoConfigUrl.href, {...denoConfig, ..._denoConfig});
      }

      const urlWithBasicAuth = new URL(params.url.href);
      username && (urlWithBasicAuth.username = username);
      password && (urlWithBasicAuth.password = password);

      return FileLoader({
        config: { ...config, ...axionConfig },
        modules
      })({ ...params, url: urlWithBasicAuth, data: { ...params?.data, denoConfig: { ...params?.data?.denoConfig, ...denoConfig } } }, res);
    }

    return RequestHandler({
      middlewares: {},
      pipes: {},
      modules: {
        path: { SEPARATOR, basename, extname, join, dirname }
      },
      handlers: {
        "/(.*)+": await fileLoaderWithAxionConfig({
          config: {
            dirEntrypoint: env.DIR_ENTRYPOINT || "index",
            loaderType: (gitInfo?.owner && gitInfo?.repo) ? 'github' : (env.DEFAULT_LOADER_TYPE || "local"),
            debug,
            useCache,
            cachettl: Number(env.CACHE_TTL) || 1000 * 60 * 10,
            owner: gitInfo?.owner || env.GIT_OWNER,
            repo: gitInfo?.repo || env.GIT_REPO,
            branch: gitInfo?.branch || env.GIT_BRANCH, // or any other branch you want to fetch files froM
            environment: gitInfo?.environment || env.ENV,
            apiKey: env.GIT_API_KEY,
          },
          modules: {
            path: {
              SEPARATOR, basename, extname, join, dirname
            },
            withCache
          }
        }),
        serializers: {}
      }
    })(req);
  },
  config: {
    PORT: env.FILE_LOADER_PORT || 9000,
    verbose: false
  }
});

self?.postMessage && self?.postMessage({ message: { 'status': 'ok' } });
