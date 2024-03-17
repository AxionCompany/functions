import IsolateManager from "./adapters/isolate-manager.ts";

export default ({ config, modules, ...dependencies }: any) =>
  async ({ url, pathname, method, data, params, queryParams, __requestId__ }: {
    url: URL;
    method: string;
    pathname: string;
    params: any | null;
    data: any | null;
    queryParams: any | null;
    __requestId__: string;
  }, response: any | null) => {
    // get module
    const { loaderUrl, username, password, functionsDir, loader, useWebWorker = true } = config;

    // create urls
    const importUrl: URL = new URL(modules.path.join(loaderUrl, functionsDir));
    importUrl.pathname = modules.path.join(importUrl.pathname, pathname);
    const currentUrl: URL = url;

    // add auth
    if (username) importUrl.username = username;
    if (password) importUrl.password = password;

    let res: any;
    let pathParams: any;

    res = await IsolateManager({ config, modules })({
      importUrl,
      currentUrl,
      method,
      pathParams: params,
      queryParams,
      data,
      __requestId__,
    }, response);

    return res;
  };
