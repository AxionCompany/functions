export default ({ url, html, addToHead, environment, metaUrl, props, shared }) => `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script type="importmap">
    ${environment === 'development'
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
    }
    </script>
    <script type="module">
    window.dynamicImport = async (url) => {
      return await import(
        \`\${url}?bundle=true&v=\${new Date().getTime()}&shared=${shared?.length ? shared.join(',') : ''}\`
      )
    }
    window.metaImport = async (url) => {
      return await import(
        \`\${url}?bundle=true&v=\${new Date().getTime()}&customBaseUrl=${metaUrl}\`
      )
    }
  </script>
    <script>
      window.importUrl = \`${url}\`;
      window.metaUrl = new URL(window.importUrl)?.origin
    </script>
    ${addToHead?.join("")}
  </head>

  <body>
  <div id="root">${html}</div>

    <script type="module">
      import React from 'react';
      import ReactDOM from 'react-dom';
      window.React = React;
      const init = async (Component) => {
        const root = ReactDOM.createRoot(document.getElementById('root'));
        const App = React.createElement(Component, ${JSON.stringify(props)});
        root.render(App);
      }
      window.importAxion = (path) => metaImport(new URL(path, window.metaUrl).href);
      const mod = await dynamicImport(window.importUrl);
      const Component = mod.GET || mod.default;
      await init(Component);
    </script>
    
  </body>

</html>
`;