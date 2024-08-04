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

    let useCache;
    const authorizationEncoded = req.headers.get('authorization')?.slice(6);
    const [username, password] = authorizationEncoded ? atob(authorizationEncoded).split(':') : [];
    debug && console.log('Received request in File Loader from', req.url, username, password);

    try {
      useCache = JSON.parse(env.USE_CACHE || 'true');
    } catch (err) {
      useCache = true;
    }

    const [provider, org, repo, branch, environment] = username?.split('--') || [];

    const fileLoaderWithAxionConfig = async ({ config, modules }) => async (params, res) => {

      const axionConfigUrl = new URL('/axion.config.json', params.url);
      const denoConfigUrl = new URL('/deno.json', params.url);
      const urlWithBasicAuth = new URL(params.url);

      if (username) {
        axionConfigUrl.username = username;
        denoConfigUrl.username = username;
        urlWithBasicAuth.username = username;
      }
      if (password) {
        axionConfigUrl.password = password;
        denoConfigUrl.password = password;
        urlWithBasicAuth.password = password;
      };
      let axionConfig = axionConfigs.get(axionConfigUrl.origin);
      let _denoConfig = denoConfigs.get(denoConfigUrl.origin);

      const responseMock = Object.entries(res).reduce((acc, [key, value]) => {
        acc[key] = (() => { });
        return acc;
      }, {})

      const fileLoader = FileLoader({ config, modules });

      if (!axionConfig) {
        debug && console.log('axion.config.json not found in cache for', axionConfigUrl.origin, 'fetching from server...')
        axionConfig = await fileLoader({
          queryParams: {},
          headers: { 'content-type': 'text/plain' },
          pathname: axionConfigUrl.pathname,
          url: axionConfigUrl,
        }, responseMock);

        axionConfig = JSON.parse(axionConfig || '{}')
        axionConfigs.set(axionConfigUrl.origin, axionConfig);
      }

      if (!_denoConfig) {
        debug && console.log('deno.json not found in cache for', denoConfigUrl.origin, 'fetching from server...')
        _denoConfig = await fileLoader({
          queryParams: {},
          headers: { 'content-type': 'text/plain' },
          pathname: '/deno.json',
          url: denoConfigUrl,
        }, responseMock);

        _denoConfig = JSON.parse(_denoConfig || '{}')
        const nodeConfig = await fileLoader({
          queryParams: {},
          headers: { 'content-type': 'text/plain' },
          pathname: '/package.json',
          url: denoConfigUrl,
        }, responseMock);
        const nodeConfigJson = JSON.parse(nodeConfig || '{}');
        _denoConfig.imports = _denoConfig?.imports || {};
        Object.entries(nodeConfigJson?.dependencies || {}).forEach(([key, value]) => {
          if (value.startsWith('http') || value.startsWith('file') || value.startsWith('npm:') || value.startsWith('node:')) {
            _denoConfig.imports[key] = value;
          } else {
            _denoConfig.imports[key] = `npm:${key}@${value}`;
          }
        });
        denoConfigs.set(denoConfigUrl.origin, { ...denoConfig, ..._denoConfig });
      }

      // const urlWithBasicAuth = new URL(params.url.href);
      // username && (urlWithBasicAuth.username = username);
      // password && (urlWithBasicAuth.password = password);



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
            debug,
            useCache,
            cachettl: Number(env.CACHE_TTL) || 1000 * 60 * 10,
            loaderType: provider || env.DEFAULT_LOADER_TYPE || 'local', //(gitInfo?.owner && gitInfo?.repo) ? 'github' : (env.DEFAULT_LOADER_TYPE || "local"),
            owner: org || env.GIT_OWNER,
            repo: repo || env.GIT_REPO,
            branch: branch || env.GIT_BRANCH, // or any other branch you want to fetch files froM
            environment: environment || env.ENV,
            apiKey: password || env.GIT_API_KEY,
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
