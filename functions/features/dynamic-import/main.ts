// import DynamicImport from "./adapters/module-bundler.ts";
const v: any = {};

import Isolate from "./adapters/isolate.ts";

export default ({ config, ...dependencies }: any) =>
async ({ pathname, data, params, queryParams }: {
  pathname: string;
  params: any | null;
  data: any | null;
  queryParams: any | null;
}, response: any | null) => {
  // get module
  const { loaderUrl, username, password, customLoader, useIsolate = true } =
    config;

  // cache busting
  if (v && !v[pathname] || pathname.endsWith("/___cacheBust___")) {
    pathname = pathname.replace("/___cacheBust___", "");
    v[pathname] = Date.now();
  }

  // create url
  const url: URL = new URL(pathname, loaderUrl);
  // add cache busting
  if (v) url.searchParams.set("v", v[pathname]);
  // add auth
  if (username) url.username = username;
  if (password) url.password = password;

  // import module
  let mod: any;
  let pathParams: any;

  if (useIsolate) {
    return await Isolate({ config })({
      url,
      pathParams: params,
      queryParams,
      data,
    });
  }
  if (customLoader) {
    const { default: _mod, _pathParams, _matchedPath } = await customLoader(
      url.href,
    );
    mod = _mod;
    pathParams = _pathParams;
    matchedPath = _matchedPath;
  } else {
    const { default: _mod, _pathParams, _matchedPath } = await import(url.href);
    mod = _mod;
    pathParams = _pathParams;
    matchedPath = _matchedPath;
  }
  if (typeof mod !== "function") {
    throw { message: "Module Not Found", status: 404 };
  }
  const res = await (await mod(dependencies))({
    ...data,
    ...queryParams,
    ...pathParams,
  });

  return res;
};
