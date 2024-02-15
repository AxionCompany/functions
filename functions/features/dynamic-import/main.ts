// import DynamicImport from "./adapters/module-bundler.ts";
const v: any = {};

import WorkerManager from "./adapters/worker-manager.ts";
// import WorkerManager from "./adapters/isolate-manager.ts";
import ModuleExecution from "./adapters/module-execution.tsx";

export default ({ config, ...dependencies }: any) =>
  async ({ url, pathname, data, params, queryParams, __requestId__ }: {
    url: URL;
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

    // create urls
    const importUrl: URL = new URL(pathname, loaderUrl);
    const currentUrl: URL = url;

    // add cache busting
    if (v) importUrl.searchParams.set("v", v[pathname]);
    // add auth
    if (username) importUrl.username = username;
    if (password) importUrl.password = password;

    let res: any;
    let pathParams: any;

    if (useWebWorker) {
      try {
        res = await WorkerManager({ config })({
          importUrl,
          currentUrl,
          pathParams: params,
          queryParams,
          data,
          __requestId__,
        }, response);
      } catch (err) {
        console.log(err);
      }
    } else {
      res = await ModuleExecution({ loader, dependencies })({
        importUrl,
        currentUrl,
        ...data,
        ...queryParams,
        ...pathParams,
      }, response);
    }

    return res;
  };
