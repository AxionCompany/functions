import moduleLoader from "./utils/moduleLoader.ts";

const tryParseJSON = (str: any) => {
  try {
    return JSON.parse(str);
  } catch (err) {
    return str;
  }
};

export default async (config: any) => {
  let { loader, functionsDir, dependencies: remoteDependencies, url, importUrl, env, isJSX } = config || {};
  if (!loader) loader = moduleLoader;
  // load the module
  const { mod: defaultModule, GET, POST, PUT, DELETE, matchedPath, middlewares, beforeRun, afterRun, dependencies, ...moduleExports } = await loader(
    { importUrl, url, env, dependencies: remoteDependencies, isJSX, functionsDir },
  );

  const execute = async (
    data: any,
    response: any = null,
  ) => {
    try {

      const getParams = (data: any) => {
        return { ...data.data, ...data.formData, ...data.queryParams }
      }

      data.params = getParams(data);
      const url = data.url;

      // run middlewares
      // pass dependencies to middlewares
      Object.assign(middlewares, dependencies)
      // execute middleware
      data = await middlewares(data, response);

      // if the middleware returns a response, return it
      if (data._forceResponse) return data._forceResponse;

      // get middleware-defined dependencies;
      Object.assign(dependencies, { ...middlewares });

      // pass dependencies to beforeRun and afterRun hooks, and set them as globalThis
      beforeRun && Object.assign(beforeRun, dependencies) && (globalThis._beforeRun = beforeRun);
      afterRun && Object.assign(afterRun, dependencies) && (globalThis._afterRun = afterRun);

      // get the data
      const { method, body, params, headers: requestHeaders, __requestId__ } = data;

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

      // merge path params
      const reqData = { headers: requestHeaders, body, ...params, __requestId__ };

      // execute the module
      const workerRes = await moduleInstance({ mod, params: reqData, dependencies, url, isJSX, importUrl, functionsDir }, response);

      // try parsing the response as JSON
      const chunk = tryParseJSON(workerRes);

      // return the response
      return chunk;

    } catch (err) {

      throw err;
    }
  };
  return execute
};

const moduleInstance: any = async (
  { mod, params, dependencies, url, importUrl, isJSX, functionsDir }
    : { mod: Function, params: any, dependencies: any, url: string, importUrl: string, isJSX: boolean; functionsDir: string },
  response: any,
) => {

  let workerRes: any;
  try {

    const { headers, __requestId__, body, ..._params } = params;
    params = _params;

    if (dependencies?.config?.isFactory) {
      mod = await mod({
        ...dependencies,
        ...params,
      }, response);
    } else {
      Object.assign(mod, { ...dependencies, body, headers, __requestId__, url });
    }

    if (isJSX) {
      Object.assign(mod, { response });
      // set html content type headers
      response.headers({ "content-type": "text/html; charset=utf-8" });
      // generate layouts
      const Layout = dependencies.LayoutModules?.reduce(
        (AccLayout: any, CurrLayout: any) => {
          if (!CurrLayout) return AccLayout
          return (props: any) => dependencies.React.createElement(AccLayout, props, CurrLayout(props))
        },
        ({ children }: any) => children
      );
      const { headers: _1, ..._pageParams } = params;
      // render the JSX component
      const html = dependencies?.ReactDOMServer.renderToString(
        dependencies.React.createElement(
          Layout,
          _pageParams,
          dependencies.React.createElement(mod, _pageParams)
        )
      );
      // parse the html
      const document = new dependencies.DOMParser().parseFromString(dependencies.indexHtml, 'text/html');

      // add html to 'main' element in body
      let mainElement = document.body.querySelector('main');
      if (!mainElement) {
        mainElement = document.createElement('main');
        mainElement.innerHTML = html
        document.body.appendChild(mainElement);
      } else {
        mainElement.innerHTML = html
      }

      const compiledHtml = [dependencies.bundledLayouts.join('\n'), dependencies.bundledModule].join('\n');
      // compile css script
      let css = '';
      let completeCss;
      if (dependencies.postCssConfig) {
        // build css with page visible elements, only
        css = await dependencies.processCss(dependencies.postCssConfig, html, importUrl);
        // async build css with all elements and dependent components
        completeCss = dependencies.withCache(
          dependencies.processCss,
          { keys: ['css', importUrl], expireIn: 1000 * 60 },
          dependencies.postCssConfig, compiledHtml, importUrl
        )
      }
      // add css to head
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
      // build scripts
      const { headScripts, bodyScripts } = dependencies.htmlScripts({
        url,
        props: _pageParams,
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
      // stream up to the main element for readly availability of SSR content 
      if (completeCss) {
        const endIndex = workerRes.indexOf('</body>');
        if (endIndex > -1) {
          const endChunk = workerRes.slice(0, endIndex);
          response.stream(endChunk + '\n')
          // then, stream script for updating the style tag
          await completeCss.then((css: string) =>
            css && response.stream(`
            <script>
            const style = document.querySelector('style');
            style.textContent += ${JSON.stringify(css)};
            </script>
            `))
          workerRes = workerRes.slice(endIndex);
          response.stream(workerRes + '\n')
        }
      } else {
        response.stream(workerRes + '\n')
      }
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