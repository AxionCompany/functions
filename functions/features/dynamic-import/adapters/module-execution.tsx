import moduleLoader from "./module-loader.ts";

const tryParseJSON = (str: any) => {
  try {
    return JSON.parse(str);
  } catch (err) {
    return str;
  }
};

const getModuleType = async (mod: any, props: any = {},) => {
  try {
    if (typeof mod === "function") {
      const instance = await mod(props);
      if (typeof instance === "function") {
        return 'instance';
      }
      if (typeof instance.type === "function") {
        return 'jsx';
      }
      return 'function';
    } else {
      return typeof mod;
    }

  } catch (err) {
    return typeof mod;
  }
}

const htmlToRenderWithHydrateScript = (html: any, customTags: any, component: any, props: any) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
      
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        ${customTags.join("")}
      </head>
      <body>
        <div id="root">${html}</div>
      </body>
      <script type="module" >
      import ReactDOMClient from 'https://dev.jspm.io/react-dom/client';
      import React from 'https://dev.jspm.io/react';
      ReactDOMClient.hydrateRoot(
        document.getElementById("root"),
        React.createElement(${component}, ${JSON.stringify(props)})
      )
      </script>
    </html>
  `;
}

export default (config: any) => {
  let { loader, dependencies } = config || {};
  if (!loader) loader = moduleLoader;
  return async (
    data: any,
    response: any = null,
    context: any = globalThis,
  ) => {
    try {
      const { importUrl, params, isJSX } = data;

      const { mod, pathParams, matchedPath, dependencies: deps } = await loader(
        { importUrl, dependencies },
      );

      let workerRes;
      // check if mod() is a function
      const modType = await getModuleType(mod, { ...deps, ...params });

      if (modType === 'function' || modType === 'jsx') {
        context.deps = deps;
        if (isJSX) {
          // instantiate twind;
          dependencies.twindSetup(deps?.tailwind);
          // set html content type headers
          response.headers({
            "Content-Type": "text/html",
          });

          // Create a React element from the component
          const Component = mod;
          const React = dependencies.React;
          workerRes = await mod({ matchedPath, ...pathParams, ...params }, response);
          workerRes = dependencies?.ReactDOMServer.renderToString(workerRes);
          const body = dependencies?.shim(workerRes);
          const styleTag = dependencies?.getStyleTag(dependencies.sheet);
          const bundle = await dependencies.bundle(importUrl);
          workerRes = htmlToRenderWithHydrateScript(body, [styleTag], bundle, {
            matchedPath,
            ...pathParams,
            ...params,
          });

        } else {
          workerRes = await mod({
            matchedPath,
            ...pathParams,
            ...params,
          }, response);
        }
      } else {

        const workerInstance = await mod({ ...deps, ...params });
        if (isJSX) {
          // instantiate twind;
          dependencies.twindSetup(deps?.tailwind);
          // set html content type headers
          response.headers({
            "Content-Type": "text/html",
          });

          // Create a React element from the component
          const Component = workerInstance;
          const React = dependencies.React;
          workerRes = <Component matchedPath={matchedPath} {...pathParams} {...params} />;

          workerRes = dependencies?.ReactDOMServer.renderToString(workerRes);

          const body = dependencies?.shim(workerRes);
          const styleTag = dependencies?.getStyleTag(dependencies.sheet);
          const bundle = await dependencies.bundle(importUrl);
          workerRes = htmlToRenderWithHydrateScript(body, [styleTag], bundle, {
            matchedPath,
            ...pathParams,
            ...params,
          });

        } else {
          workerRes = await workerInstance({
            matchedPath,
            ...pathParams,
            ...params,
          }, response);
        }
      }
      // try parsing the response as JSON
      const chunk = tryParseJSON(workerRes);

      return chunk;
    } catch (err) {
      console.log(err);
      throw err;
    }
  };
};
