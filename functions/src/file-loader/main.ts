
import FileLoader from "./adapters/loaders/main.ts";
import bundler from './adapters/bundler/esbuild.js';
import transformer from "./adapters/transformers/higherOrderFunction.js";
import mime from 'npm:mime/lite';

export default ({ config, modules }: any) => {

  const fileLoader = FileLoader({ config, modules });

  return async ({ pathname, url, headers, queryParams, data, __requestId__ }: any, res: any) => {

    const { bundle: shouldBundle, shared, ...searchParams } = queryParams;
    // check if headers type is application/json
    const contentTypeHeaders = headers["content-type"];
    const bustCache = data?.bustCache;
    config.bustCache = bustCache;

    const isImport =
      !(contentTypeHeaders && contentTypeHeaders?.includes("application/json"));

    const { loaderType } = config || { loaderType: "local" };

    config.debug && config.verbose && console.log(
      `Loading file ${pathname} with loader ${loaderType}`,
    );

    const startTime = Date.now();
    let fileData;
    try {
      fileData = await fileLoader({ path: pathname })
    } catch (_) { }

    let { content, redirect, params, path, variables, matchPath } = fileData || {};

    if (!content) {
      res.status(404);
      res.statusText(`No path found for ${pathname}`)
      return;
    }

    config.debug && console.log(`Loaded file ${url.href} in ${Date.now() - startTime}ms`)

    if (shouldBundle) {

      const bundleUrl = url
      bundleUrl.pathname = matchPath;
      bundleUrl.search = ''

      const bundleContent = await modules.withCache(
        bundler,
        { useCache: config.useCache, bustCache, keys: [bundleUrl.href], cachettl: 1000 * 60 * 60 * 24 },
        bundleUrl,
        { shared: shared?.split(','), ...variables, ...data, ...params, environment: config.environment }
      );

      if (bundleContent) {
        return { content: bundleContent, params, path, matchPath };;
      }
    }

    redirect = redirect && !shouldBundle;
    if (redirect) {
      // logic for redirecting to the new path, so the loader will get the correct file extension from the path in URL.
      // Downside is that there will be an overhead of another request being made to the new path.
      const redirectUrl = new URL(url.href);
      redirectUrl.search = new URLSearchParams(searchParams).toString();
      redirectUrl.pathname = path;
      config.debug && console.log(`Redirecting to ${redirectUrl.href}`);
      return res.redirect(redirectUrl.href);
    }

    if (!isImport) {
      return { content, redirect, params, path, variables, matchPath };
    }

    if (['js', 'jsx', 'ts', 'tsx'].includes(matchPath?.split('.').pop())) {
      // if (params) { // add export for params in content
      //   content += `\n\nexport const _pathParams = ${JSON.stringify(params)};`;
      // }
      content += `\n\nexport const _matchPath="${matchPath?.replaceAll('\\', '/')}"`;
      // transform the content
      if (['js', 'ts'].includes(pathname.split('.').pop())) {
        content = transformer({ code: content, url });
      }

      // ISSUE: Some projects may have .js or .ts files that actually contain .jsx or .tsx code.
      // CURRENT SOLUTION: Set a fixed content type for stating that the file is .tsx type (should work for parsing .js, .ts, .jsx, .tsx files as well). 
      // TO DO: This is probably *not* the best idea, as there's an overhead in Deno Compiler. Think about how to improve it the future. 
      res.headers({ 'content-type': 'text/tsx; charset=utf-8' })

    } else {
      // set mime type for public files
      setMimeType(res, matchPath);
    }

    return content;
  };
}


const setMimeType = (res: any, pathname: string) => {
  const mimeType = mime.getType(pathname);
  res.headers({ 'content-type': mimeType })
}
