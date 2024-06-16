import moduleLoader from "./module-loader.ts";

const tryParseJSON = (str: any) => {
  try {
    return JSON.parse(str);
  } catch (err) {
    return str;
  }
};

export default (config: any) => {
  let { metaUrl, loader, functionsDir, method, dependencies: remoteDependencies, ...rest } = config || {};
  if (!loader) loader = moduleLoader;
  return async (
    data: any,
    response: any = null,
  ) => {
    try {

      // get the data
      const { importUrl, currentUrl, params: requestParams, headers: requestHeaders, isJSX, __requestId__ } = data;

      // load the module
      const { mod: defaultModule, GET, POST, PUT, DELETE, pathParams, matchedPath, dependencies: localDependencies, ...moduleExports } = await loader(
        { importUrl, dependencies: remoteDependencies, isJSX },
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
      const params = { headers: requestHeaders, ...requestParams, ...pathParams, __requestId__ };

      // execute the module
      const workerRes = await moduleInstance({ mod, params, dependencies, url: currentUrl, metaUrl, isJSX, importUrl, functionsDir }, response);

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
  { mod, params, dependencies, url, importUrl, metaUrl, isJSX, functionsDir }
    : { mod: Function, params: any, dependencies: any, url: string, importUrl: string, metaUrl: string, isJSX: boolean; functionsDir: string },
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
      // generate layouts
      const Layout = dependencies.LayoutModules.reduce(
        (AccLayout: any, CurrLayout: any) => {
          if (!CurrLayout) return AccLayout
          return (props: any) => dependencies.React.createElement(AccLayout, props, CurrLayout(props))
        },
        ({ children }: any) => children
      );
      // render the JSX component
      const html = dependencies?.ReactDOMServer.renderToString(
        dependencies.React.createElement(
          Layout,
          params,
          dependencies.React.createElement(mod, params)
        )
      );
      // parse the html
      const document = new dependencies.DOMParser().parseFromString(dependencies.indexHtml, 'text/html');

      // add html to a div in body
      const div = document.createElement('div');
      div.id = 'root';
      div.innerHTML = html;
      document.body.appendChild(div);

      // compile css script
      const css = dependencies.postCssConfig ? await dependencies.processCss(dependencies.postCssConfig, html, importUrl) : '';
      // add css to head
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
      const { headScripts, bodyScripts } = dependencies.htmlScripts({
        url,
        metaUrl,
        props: params,
        layoutUrls: dependencies.layoutUrls.map((url: string) => url.replace(`${functionsDir}/`, '')),
        environment: (dependencies?.env?.ENV || 'production'),
        shared: dependencies?.config?.sharedModules
      });
      // add scripts to head
      headScripts.forEach((script: any) => {
        const scriptTag = document.createElement('script');
        scriptTag.innerHTML = script.content;
        scriptTag.type = script.type;
        document.head.appendChild(scriptTag);
      });
      // add scripts to body
      bodyScripts.forEach((script: any) => {
        const scriptTag = document.createElement('script');
        scriptTag.innerHTML = script.content;
        scriptTag.type = script.type;
        document.body.appendChild(scriptTag);
      });
      // render the html template
      workerRes = document.toString();
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


