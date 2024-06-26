import moduleLoader from "./module-loader.ts";
import { createHash } from "../../../modules/connectors/security.js";
import { get, set } from "https://deno.land/x/kv_toolbox/blob.ts";


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
        { importUrl, currentUrl, dependencies: remoteDependencies, isJSX },
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
      const { headers, ..._pageParams } = params;
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

      // add html to a div in body
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
      // build css with page visible elements, only
      const css = await (buildStyles(dependencies))(html, { importUrl });
      // async build css with all elements and dependent components
      const completeCss = (buildStyles(dependencies))(compiledHtml, { importUrl });
      // add css to head
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
      // build scripts
      const { headScripts, bodyScripts } = dependencies.htmlScripts({
        url,
        metaUrl,
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
      // stream the response
      for (let chunk of workerRes.split("\n")) {
        // stream up to the main element for readly availability of SSR content 
        const endIndex = chunk.indexOf('</body>');
        if (endIndex > -1) {
          const endChunk = chunk.slice(0, endIndex);
          response.stream(endChunk + '\n')
          // then, stream script for updating the style tag
          await completeCss.then((css: string) =>
            css && response.stream(`
          <script>
          const style = document.querySelector('style');
          style.textContent = ${JSON.stringify(css)};
          </script>
          `))
          chunk = chunk.slice(endIndex);
        }
        // stream the rest of the content
        response.stream(chunk + '\n')
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


const buildStyles = (dependencies: any) => async (html: string, { importUrl }: { importUrl: string }) => {
  if (dependencies.postCssConfig) {

    const hash = await createHash(html);
    const kv = await Deno.openKv();
    try {
      const cachedData: any = await get(kv, ['cache', 'styles', hash])
      if (cachedData?.value) {
        const cachedStyle = new TextDecoder('utf-8').decode(cachedData.value);
        return cachedStyle
      } else {
        const style = await dependencies.processCss(dependencies.postCssConfig, html, importUrl)
        set(kv, ['cache', 'styles', hash], new TextEncoder().encode(style), { expireIn: 1000 * 60 });
        return style;
      }
    } catch (_) { }
  }
  return ''
}