
import FileLoader from "./adapters/loaders/main.ts";
import bundle from './adapters/bundler/esbuild.js';

export default ({ config, modules }: any) => {

  const fileLoader = FileLoader({ config, modules });

  return async ({ pathname, url, headers, queryParams, data, ...rest }: any, res: any) => {
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
    let { content, redirect, params, path, variables, matchPath } = await modules.withCache(
      fileLoader,
      { cachettl: config.cachettl, useCache: config.useCache, keys: ['file-loader', url.href] }, {
      path: pathname
    }) || {};

    if (!path && !customBaseUrl) {
      res.status(404);
      res.statusText(`No path found for ${pathname}`)
      return;
    }
    config.debug && console.log(`Loaded file ${url.href} in ${Date.now() - startTime}ms`)

    if (shouldBundle) {
      if (customBaseUrl) {
        path = new URL(customBaseUrl).pathname + pathname;
        path = path.replace('//', '/');
      }
      const bundleUrl = new URL(`${path}?${new URLSearchParams(searchParams).toString()}`, customBaseUrl ? customBaseUrl : url.origin);
      const bundleContent = await modules.withCache(
        bundle,
        { cachettl: config.cachettl, useCache: false, keys: ['bundler', bundleUrl.href] },
        bundleUrl,
        { shared: shared?.split(','), ...data, environment: config.environment }
      ).then(res => res).catch(console.log);

      if (bundleContent) {
        return { content: bundleContent, params, path, matchPath };;
      }
    }

    redirect = redirect && !shouldBundle;
    if (redirect) {
      // logic for redirecting to the new path, so the loader will get the correct file extension from the path in URL.
      // Downside is that there will be an overhead of another request being made to the new path.
      if (!path.startsWith('/')) path = `/${path}`;
      const redirectUrl = new URL(`${path}?${new URLSearchParams(searchParams).toString()}`, url.origin);
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

      // ISSUE: Some projects may have .js or .ts files that actually contain .jsx or .tsx code.
      // CURRENT SOLUTION: Set a fixed content type for stating that the file is .tsx type (should work for parsing .js, .ts, .jsx, .tsx files as well). 
      // TO DO: This is probably *not* the best idea, as there's an overhead in Deno Compiler. Think about how to improve it the future. 
      res.headers({ 'content-type': 'text/tsx' })

    }

    return content;
  };
}