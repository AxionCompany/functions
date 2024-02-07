import * as FileLoaders from "./adapters/main.ts";

const fileLoaders: any = { ...FileLoaders };

export default ({ config }: any) =>
  async ({ pathname, pathParams, url, headers, searchParams }: any, res: any) => {
    // check if headers type is application/json
    const contentTypeHeaders = headers["content-type"];

    const isImport =
      !(contentTypeHeaders && contentTypeHeaders?.includes("application/json"));

    url = new URL(`${url.origin}/${config.functionsDir}${pathname}`);
    const { loaderType } = config || { loaderType: "local" };

    config.verbose && console.log(
      `Loading file ${pathname} with loader ${loaderType}`,
    );

    let { content, redirect, error, params, path, matchPath } =
      await (fileLoaders[loaderType]({ config }))(
        {
          path: pathname,
        },
      ) || {};

    if (error) {
      res.status(404);
      return error;
    }

    if (redirect) {
      const baseUrl = url.origin;
      const redirectUrl = new URL(`${path}?${new URLSearchParams(searchParams).toString()}`, baseUrl);
      config.verbose && console.log(`Redirecting to ${redirectUrl.href}`);
      return res.redirect(redirectUrl.href);
    }

    if (!isImport) {
      return { content, redirect, error, params, path, matchPath };
    }

    if (params) { // add export for params in content
      content += `\n\nexport const _pathParams = ${JSON.stringify(params)};`;
    }

    content += `\n\nexport const _matchPath="${matchPath?.replaceAll('\\', '/')}"`;

    return content;
  };
