// import DynamicImport from "./adapters/module-bundler.ts";
const v: any = {};

import WorkerManager from "./adapters/workerManager.ts";
import ModuleExecution from "./adapters/module-execution.ts";

export default ({ config, ...dependencies }: any) =>
async ({ pathname, data, params, queryParams, __requestId__ }: {
  pathname: string;
  params: any | null;
  data: any | null;
  queryParams: any | null;
  __requestId__: string;
}, response: any | null) => {
  // get module
  const { loaderUrl, username, password, loader, useWebWorker = true } = config;

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

  let res: any;
  let pathParams: any;

  if (useWebWorker) {
    res = await WorkerManager({ config })({
      url,
      pathParams: params,
      queryParams,
      data,
      __requestId__,
    }, response);
  } else {
    res= await ModuleExecution({ loader, dependencies })({
      ...data,
      ...queryParams,
      ...pathParams,
    }, response);
  }

  return res;
};
