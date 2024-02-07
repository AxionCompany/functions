import moduleLoader from "./module-loader.ts";

const tryParseJSON = (str: any) => {
  try {
    return JSON.parse(str);
  } catch (err) {
    return str;
  }
};

const htmlToRenderWithHydrateScript = (html: any, customTags: any, component: any, props: any, defaultDeclaration) => `
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
  <script type="module">
    import ReactDOMClient from 'https://esm.sh/react-dom/client';
    import React from 'https://esm.sh/react';

    ${component}

    const recursiveReactElement = ${recursiveReactElement.toString()};

    const { Component, iter } = await recursiveReactElement(${defaultDeclaration}, ${JSON.stringify(props)}, {React});
    ReactDOMClient.hydrateRoot(
      document.getElementById("root"),
      Component
    )

  </script>
</html>
`;


export default (config: any) => {
  let { loader, dependencies: remoteDependencies } = config || {};
  if (!loader) loader = moduleLoader;
  return async (
    data: any,
    response: any = null,
    context: any = globalThis,
  ) => {
    try {
      const { importUrl, params: requestParams, isJSX } = data;

      const { mod, pathParams, matchedPath, dependencies: localDependencies } = await loader(
        { importUrl, dependencies: remoteDependencies },
      );

      const dependencies = { localDependencies, remoteDependencies };

      const params = { ...requestParams, ...pathParams };

      const workerRes = await moduleInstance(mod, params, dependencies, importUrl, response, isJSX);

      // try parsing the response as JSON
      const chunk = tryParseJSON(workerRes);

      return chunk;
    } catch (err) {
      console.log(err);
      throw err;
    }
  };
};

const moduleInstance: any = async (mod: any, params: any = {}, dependencies: any = {}, importUrl: string, response: any, isJSX: boolean, iter = 0) => {
  const { localDependencies, remoteDependencies } = dependencies;
  self.deps = { ...localDependencies, ...remoteDependencies };

  try {
    let workerRes;
    if (isJSX) {
      // set html content type headers
      response.headers({
        "Content-Type": "text/html",
      });

      const { Component } = await recursiveReactElement(mod, params, self.deps);
      const html = remoteDependencies.ReactDOMServer.renderToString(Component);
      const css = await remoteDependencies.getCss(localDependencies?.tailwind, html, localDependencies?.globalsCss)
      const bundle = (await remoteDependencies.bundle(importUrl));
      const defaultDeclaration = remoteDependencies.findDefaultExportedVariable(bundle.code);

      workerRes = htmlToRenderWithHydrateScript(html, [`<style>\n${css}\n</style>`], bundle.code, params,defaultDeclaration);

      // stream workerRes response
      workerRes.split("\n").forEach((line: any) => {
        response.stream(line);
      });
      return;
    }
    else {
      workerRes = await mod({
        ...localDependencies,
        ...remoteDependencies,
        ...params,
      }, response);
    }

    if (typeof workerRes === 'function') {
      workerRes = await moduleInstance(workerRes, params, dependencies, importUrl, response, isJSX, iter + 1);
    }

    return workerRes;

  } catch (err) {
    throw err;
  }
}


const recursiveReactElement: any = async (mod: any, props: any, deps: any, iter = 0) => {
  try {
    if (typeof await mod(deps) === 'function') {
      return recursiveReactElement(await mod(deps), props, deps, iter + 1)
    }
    else {
      return { iter, Component: deps.React.createElement(mod, props) }
    }
  } catch (err) {
    return { iter, Component: deps.React.createElement(mod, props) };
  }
}