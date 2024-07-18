const createScripts = ({
  url,
  environment,
  metaUrl,
  props,
  layoutUrls,
  shared
}) => {

  const baseUrl = new URL(url)
  if (environment === 'development') {
    baseUrl.protocol = 'http:'
  } else {
    baseUrl.protocol = 'https:'
  }

  const headScripts = [
    {
      type: 'importmap',
      content: environment === 'development'
        ? JSON.stringify({
          "imports": {
            "react": "https://ga.jspm.io/npm:react@18.3.1/dev.index.js",
            "react-dom/client": "https://ga.jspm.io/npm:react-dom@18.3.1/dev.client.js"
          },
          "scopes": {
            "https://ga.jspm.io/": {
              "react-dom": "https://ga.jspm.io/npm:react-dom@18.3.1/dev.index.js",
              "scheduler": "https://ga.jspm.io/npm:scheduler@0.23.2/dev.index.js"
            }
          }
        })
        : JSON.stringify({
          "imports": {
            "react": "https://ga.jspm.io/npm:react@18.3.1/index.js",
            "react-dom/client": "https://ga.jspm.io/npm:react-dom@18.3.1/client.js"
          },
          "scopes": {
            "https://ga.jspm.io/": {
              "react-dom": "https://ga.jspm.io/npm:react-dom@18.3.1/index.js",
              "scheduler": "https://ga.jspm.io/npm:scheduler@0.23.2/index.js"
            }
          }
        })
    },
    {
      type: 'text/javascript',
      content: `
      window.baseUrl = "${baseUrl.origin}";
      window.importPath = "${baseUrl.pathname}";
      window.isServer = false;
      window.dynamicImport = async (path) => {
        return await import(
          \`\${new URL(path,window.baseUrl).href}?bundle=true&shared=${shared?.length ? shared.join(',') : ''}\`
        )
      }
      window.metaImport = async (path) => {
        return await import(
          \`\${new URL(path,window.baseUrl).href}?bundle=true&customBaseUrl=${metaUrl}\`
        )
      }`
    },

  ]

  const bodyScripts = [
    {
      type: 'module',
      content: `
           import React from 'react';
           import {hydrateRoot} from 'react-dom/client';
           window.React = React;
           const init = async (App) => {
             // Hydrate the App
             hydrateRoot(document.body.querySelector('main'), App);
           }
           window.importAxion = (path) => metaImport(path);
           const layouts = await Promise.all([
            ${layoutUrls.map((path) => `"${path}"`).join(",")}
           ].map(async (path) => await dynamicImport(path)));
           const Layout = layouts.reduce(
            (acc, mod) => {
              const LayoutComponent = mod.GET || mod.default;
              if (!LayoutComponent) return acc;
              return (props) => React.createElement(acc, props, React.createElement(LayoutComponent,props));
           }, 
            ({ children }) => children
           );
           const props = ${JSON.stringify(props)};
           const mod = await dynamicImport(window.importPath);
           const Component = mod.GET || mod.default;
           const App = React.createElement(
            Layout, 
            props,
            React.createElement(
              Component,
              props,
            )
          );
           await init(App);
      `
    },
  ]
  return {
    headScripts,
    bodyScripts
  }
}
export default createScripts;