import moduleLoader from "./module-loader.ts";

const tryParseJSON = (str: any) => {
  try {
    return JSON.parse(str);
  } catch (err) {
    return str;
  }
};

export default (config: any) => {
  let { loader, method, dependencies: remoteDependencies } = config || {};
  if (!loader) loader = moduleLoader;
  return async (
    data: any,
    response: any = null,
  ) => {
    try {

      // get the data
      const { importUrl, currentUrl, params: requestParams, isJSX, __requestId__ } = data;

      // load the module
      const { mod: defaultModule, GET, POST, PUT, DELETE, pathParams, matchedPath, dependencies: localDependencies, ...moduleExports } = await loader(
        { importUrl, dependencies: remoteDependencies },
      );

      // get the config
      moduleExports.config = moduleExports.config || {};

      // define methods
      const methods: any = { GET, POST, PUT, DELETE };

      // get the requested method
      const mod = methods[method.toUpperCase()] || defaultModule;

      // if no module is found
      if (!mod) {
        response.status(404)
        response.statusText("Module not found")
        return "Module Not Found"
      }

      // merge dependencies
      const dependencies = { ...localDependencies, ...remoteDependencies };

      // merge path params
      const params = { ...requestParams, ...pathParams, __requestId__ };

      // execute the module
      const workerRes = await moduleInstance({ mod, params, dependencies, url: currentUrl, isJSX, importUrl }, response);

      // try parsing the response as JSON
      const chunk = tryParseJSON(workerRes);

      // return the response
      return chunk;

    } catch (err) {
      console.log(err);
      throw err;
    }
  };
};

const moduleInstance: any = async (
  { mod, params, dependencies, url, importUrl, isJSX }
    : { mod: Function, params: any, dependencies: any, url: string, importUrl: string, isJSX: boolean },
  response: any,
) => {

  let workerRes: any;
  try {

    if (dependencies?.config?.isFactory) {
      mod = await mod({
        ...dependencies,
        ...params,
      }, response);
    } else {
      Object.assign(mod, { ...dependencies, url });
    }

    if (isJSX) {
      Object.assign(mod, { response });
      // set html content type headers
      response.headers({ "content-type": "text/html; charset=utf-8" });
      // render the JSX component
      const html = dependencies?.ReactDOMServer.renderToString(dependencies.React.createElement(mod, params));
      // process css
      const css = dependencies.postCssConfig ? await dependencies.processCss(dependencies.postCssConfig, html, importUrl) : '';
      // render the html template
      workerRes = dependencies.htmlTemplate({ html, url, addToHead: [`<style>\n${css}\n</style>`], props: params, environment: (dependencies.env || 'production'), shared: dependencies?.config?.sharedModules })
      // stream the response
      workerRes.split("\n").forEach((chunk: any) => response.stream(chunk + "\n"));
      // the end
      return;
    }
    else {
      // execute the module
      workerRes = await mod({
        ...params,
      }, response);
    }

    return workerRes;

  } catch (err) {
    throw err;
  }
}
