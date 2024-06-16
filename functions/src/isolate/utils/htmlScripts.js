const createScripts = ({
  url,
  environment,
  metaUrl,
  props,
  layoutUrls,
  shared
}) => {

  const headScripts = [
    {
      type: 'importmap',
      content: environment === 'development'
        ? `{
          "imports": {
            "react": "https://ga.jspm.io/npm:react@18.3.1/dev.index.js",
            "react-dom": "https://ga.jspm.io/npm:react-dom@18.3.1/dev.index.js"
          },
          "scopes": {
            "https://ga.jspm.io/": {
              "scheduler": "https://ga.jspm.io/npm:scheduler@0.23.2/dev.index.js"
            }
          }
        }`
        : `{
          "imports": {
            "react": "https://ga.jspm.io/npm:react@18.3.1/index.js",
            "react-dom": "https://ga.jspm.io/npm:react-dom@18.3.1/index.js"
          },
          "scopes": {
            "https://ga.jspm.io/": {
              "scheduler": "https://ga.jspm.io/npm:scheduler@0.23.2/index.js"
            }
          }
        }`
    },
    {
      type: 'text/javascript',
      content: `
      window.baseUrl = "${new URL(url).origin}";
      window.importPath = "${new URL(url).pathname}";
      window.dynamicImport = async (path) => {
        return await import(
          \`\${new URL(path,window.baseUrl).href}?bundle=true&v=\${new Date().getTime()}&shared=${shared?.length ? shared.join(',') : ''}\`
        )
      }
      window.metaImport = async (path) => {
        return await import(
          \`\${new URL(path,window.baseUrl).href}?bundle=true&v=\${new Date().getTime()}&customBaseUrl=${metaUrl}\`
        )
      }`
    },

  ]

  const bodyScripts = [
    {
      type: 'module',
      content: `
           import React from 'react';
           import ReactDOM from 'react-dom';
           window.React = React;
           const init = async (App) => {
             const root = ReactDOM.createRoot(document.getElementById('root'));
             root.render(App);
           }
           window.importAxion = (path) => metaImport(path);
           const layouts = await Promise.all([
            ${layoutUrls.map((path) => `"${path}"`).join(",")}
           ].map(async (path) => await dynamicImport(path)));
           const Layout = layouts.reduce((acc, mod) => {
            const LayoutComponent = mod.GET || mod.default;
            return (props) => React.createElement(LayoutComponent, props, acc(props));
           }, ({ children }) => children);
           const mod = await dynamicImport(window.importPath);
           const Component = mod.GET || mod.default;
           const App = React.createElement(
            Layout, 
            ${JSON.stringify(props)},
            React.createElement(
              Component,  
              ${JSON.stringify(props)}
            )
          );
           await init(App);
      `
    }
  ]
  return {
    headScripts,
    bodyScripts
  }
}
export default createScripts;