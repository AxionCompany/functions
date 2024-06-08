export default ({ url, html, addToHead, environment, props, shared }) => `
<!DOCTYPE html>
<html>

  <head>
    <script type="module">
      window.dynamicImport = async (url) => {
        return await import(
          \`\${url}?bundle=true&v=\${new Date().getTime()}&shared=${shared?.join(',')}\`
        )
      }
    </script>
    <script>
      window.importUrl = \`${url}\`
    </script>
    ${addToHead?.join("")}
  </head>

  <body>
  <div id="root">${html}</div>

  ${environment === 'development'
    ? (
      '<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>' +
      '<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>'
    )
    : (
      '<script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>' +
      '<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>'
    )
  }
 
    <script type="module">
      const init = async (Component) => {
        const root = ReactDOM.createRoot(document.getElementById('root'));
        const App = React.createElement(Component, ${JSON.stringify(props)});
        root.render(App);
      }
      while (!window.React || !window.ReactDOM){
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      const mod = await dynamicImport(window.importUrl);
      const Component = mod.GET || mod.default;
      await init(Component);
    </script>
    
  </body>

</html>
`;