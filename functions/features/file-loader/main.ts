
import * as FileLoaders from "./adapters/main.ts";
// import { bundle } from "https://deno.land/x/emit/mod.ts";
import bundle from './adapters/bundler/esbuild.js'

const fileLoaders: any = { ...FileLoaders };

export default ({ config, modules }: any) =>
  async ({ pathname, url, headers, queryParams }: any, res: any) => {
    const { bundle: shouldBundle, ...searchParams } = queryParams;
    // check if headers type is application/json
    const contentTypeHeaders = headers["content-type"];

    const isImport =
      !(contentTypeHeaders && contentTypeHeaders?.includes("application/json"));

    const { loaderType } = config || { loaderType: "local" };

    config.verbose && console.log(
      `Loading file ${pathname} with loader ${loaderType}`,
    );

    let { content, redirect, params, path, matchPath } =
      await (fileLoaders[loaderType]({ config }))(
        {
          path: pathname,
        },
      ) || {};

    if (!path) {
      res.status(404);
      res.statusText(`No path found for ${pathname}`)
      return;
    }

    if (shouldBundle) {
      const bundleUrl = new URL(`${path}?${new URLSearchParams(searchParams).toString()}`, url.origin);
      const bundleContent = await bundle(bundleUrl).then(res=>res).catch(console.log);
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