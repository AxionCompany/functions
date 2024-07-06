
import FileLoader from "./adapters/loaders/main.ts";
import bundle from './adapters/bundler/esbuild.js';
import { get, set, } from "https://deno.land/x/kv_toolbox/blob.ts";

export default ({ config, modules }: any) => {

  const fileLoader = FileLoader({ config });


  return async ({ pathname, url, headers, queryParams }: any, res: any) => {
    const { bundle: shouldBundle, customBaseUrl, shared, ...searchParams } = queryParams;
    // check if headers type is application/json
    const contentTypeHeaders = headers["content-type"];

    const isImport =
      !(contentTypeHeaders && contentTypeHeaders?.includes("application/json"));

    const { loaderType } = config || { loaderType: "local" };

    config.debug && config.verbose && console.log(
      `Loading file ${pathname} with loader ${loaderType}`,
    );

    const startTime = Date.now();
    let { content, redirect, params, path, variables, matchPath } = await withCache(
      fileLoader,
      { cachettl: config.cachettl, useCache: config.useCache, keys: ['file-loader', url] }, {
      path: pathname
    }) || {};
    if (!path && !customBaseUrl) {
      res.status(404);
      res.statusText(`No path found for ${pathname}`)
      return;
    }
    // console.log('Loading', pathname, { redirect, params, path, matchPath })
    config.debug && console.log(`Loaded file ${url} in ${Date.now() - startTime}ms`)

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

    redirect = redirect && !shouldBundle;
    if (redirect) {
      const baseUrl = url.origin;
      const redirectUrl = new URL(`${path}?${new URLSearchParams(searchParams).toString()}`, baseUrl);
      config.debug && console.log(`Redirecting to ${redirectUrl.href}`);
      return res.redirect(redirectUrl.href);
    }

    if (!isImport) {
      return { content, redirect, params, path, variables, matchPath };
    }

    if (['js', 'jsx', 'ts', 'tsx'].includes(matchPath?.split('.').pop())) {
      if (params) { // add export for params in content
        content += `\n\nexport const _pathParams = ${JSON.stringify(params)};`;
      }

      content += `\n\nexport const _matchPath="${matchPath?.replaceAll('\\', '/')}"`;
    }

    return content;
  };
}

export const withCache = async (cb: Function, config: { useCache: boolean | undefined, keys: string[], cachettl: number | undefined }, ...params: any[]) => {

  config.useCache = config.useCache !== false;
  config.cachettl = config.cachettl || 1000 * 60 * 10; // 10 minutes

  try {
    await createDirIfNotExists('./cache');
    const kv = await Deno.openKv('./cache/db');
    if (config.useCache) {
      const cachedData: any = await get(kv, ['cache', ...config.keys])
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
    const data = await cb(...params);
    if (config.useCache) {
      const strData = JSON.stringify(data || { error: "No data" });
      set(kv, ['cache', ...config.keys], new TextEncoder().encode(strData), { expireIn: config.cachettl });
    }
    return data;
  } catch (e) {
    console.log('ERROR', e)
  }
}

const createDirIfNotExists = async (path: string) => {
  try {
    await Deno.mkdir(path, { recursive: true });
  } catch (_) { }
}
