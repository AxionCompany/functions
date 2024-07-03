
import * as FileLoaders from "./adapters/main.ts";
import bundle from './adapters/bundler/esbuild.js';
import { get, set, } from "https://deno.land/x/kv_toolbox/blob.ts";

const fileLoaders: any = { ...FileLoaders };

export default ({ config, modules }: any) =>
  async ({ pathname, url, headers, queryParams }: any, res: any) => {
    const { bundle: shouldBundle, customBaseUrl, shared, ...searchParams } = queryParams;
    // check if headers type is application/json
    const contentTypeHeaders = headers["content-type"];

    const isImport =
      !(contentTypeHeaders && contentTypeHeaders?.includes("application/json"));

    const { loaderType } = config || { loaderType: "local" };

    config.verbose && console.log(
      `Loading file ${pathname} with loader ${loaderType}`,
    );

    const fileLoader = fileLoaders[loaderType]({ config });

    let { content, redirect, params, path, matchPath } = await responseWithCache({ path: pathname, cachettl: config.cachettl, useCache: config.useCache }, fileLoader) || {};

    if (!path && !customBaseUrl) {
      res.status(404);
      res.statusText(`No path found for ${pathname}`)
      return;
    }

    if (shouldBundle) {
      if (customBaseUrl) {
        path = new URL(customBaseUrl).pathname + pathname;
        path = path.replace('//', '/');
      }
      const bundleUrl = new URL(`${path}?${new URLSearchParams(searchParams).toString()}`, customBaseUrl ? customBaseUrl : url.origin);
      const bundleContent = await bundle(bundleUrl, { shared: shared?.split(',') }).then(res => res).catch(console.log);
      if (bundleContent) {
        return { content: bundleContent, params, path, matchPath };;
      }
    }

    redirect = (path !== pathname) && !shouldBundle;
    if (redirect) {
      const baseUrl = url.origin;
      const redirectUrl = new URL(`${path}?${new URLSearchParams(searchParams).toString()}`, baseUrl);
      config.verbose && console.log(`Redirecting to ${redirectUrl.href}`);
      return res.redirect(redirectUrl.href);
    }

    if (!isImport) {
      return { content, redirect, params, path, matchPath };
    }

    if (params) { // add export for params in content
      content += `\n\nexport const _pathParams = ${JSON.stringify(params)};`;
    }

    content += `\n\nexport const _matchPath="${matchPath?.replaceAll('\\', '/')}"`;

    return content;
  };

const responseWithCache = async (params: { path: string, cachettl: number, useCache: boolean }, fn: Function) => {
  try {
    const kv = await Deno.openKv('data/cache');
    // params.useCache=false;
    if (params.useCache) {
      await createDirIfNotExists('data/');
      const cachedData: any = await get(kv, ['cache', 'file-loader', params.path])
      if (cachedData?.value !== null) {
        const cachedContent = new TextDecoder('utf-8').decode(cachedData.value);
        let parsedContent;
        try {
          parsedContent = JSON.parse(cachedContent);
          if (parsedContent?.error) return null;
        } catch (_) {
          parsedContent = cachedContent;
        }
        return parsedContent;
      }
    }
    const data = await fn(params);
    if (params.useCache) {
      const strData = JSON.stringify(data || { error: "No data" });
      await set(kv, ['cache', 'file-loader', params.path], new TextEncoder().encode(strData), { expireIn: params.cachettl });
    }
    return data;
  } catch (_) { }
}

const createDirIfNotExists = async (path: string) => {
  try {
    await Deno.mkdir(path, { recursive: true });
  } catch (_) { }
}
