import getAllFiles from "./getAllFiles.ts";

export default async ({ url, env, importUrl, dependencies, isJSX }: any) => {
  console.log('URL', url)

  const importPromises = [];

  // Get shared module bundles
  importPromises.push(getAllFiles({
    url: importUrl,
    name: 'shared',
    extensions: ['js', 'ts'],
  }));

  // Get middleware modules
  importPromises.push(getAllFiles({
    url: importUrl,
    name: 'middleware',
    extensions: ['js', 'ts']
  }));


  const bundleUrl = new URL(importUrl);
  bundleUrl.searchParams.append('bundle', true);


  if (isJSX) {
    // Get module bundle 
    importPromises.push(fetch(bundleUrl.href).then(res => res.json()).catch(err => console.log(err.toString)));
    // get index.html files
    importPromises.push(getAllFiles({ url: importUrl, name: 'index', extensions: ['html'], returnProp: 'content' }));
    // Get Layout Bundles
    importPromises.push(getAllFiles({ url: bundleUrl, name: 'layout', extensions: ['jsx', 'tsx'] }));
  }

  // Await all import promises
  const [sharedModulesData, middlewaresData, bundledModule, indexHtmlFiles, bundledLayouts] = await Promise.all(importPromises);

  const loadPromises = [];

  // Load shared modules
  loadPromises.push(Promise.all(
    sharedModulesData.map((file) => {
      return import(new URL(`/${file?.matchPath}`, importUrl).href)
        .then((mod) => mod.default)
        .catch(err => {
          console.log(`Error Importing Shared Module \`${file?.matchPath}\`: ${err.toString()}`);
          throw { message: `Error Importing Shared Module \`${file?.matchPath}\`: ${err.toString()}`, status: 401 };
        })
    })
  ));

  // Load middleware modules
  loadPromises.push(Promise.all(
    middlewaresData.map((file) => {
      return import(new URL(`/${file?.matchPath}`, importUrl).href)
        .then((mod) => mod.default)
        .catch(err => {
          console.log(`Error Importing Middleware Module \`${file?.matchPath}\`: ${err.toString()}`);
          throw { message: `Error Importing Middleware Module \`${file?.matchPath}\`: ${err.toString()}`, status: 401 };
        })
    })
  ));

  if (isJSX) {
    // Load layout modules
    loadPromises.push(Promise.all(
      bundledLayouts.map((file) => {
        return import(new URL(`/${file?.matchPath}`, importUrl).href)
          .then((mod) => mod.default)
          .catch(err => {
            console.log(`Error Importing Layout Module \`${file?.matchPath}\`: ${err.toString()}`);
            throw { message: `Error Importing Layout Module \`${file?.matchPath}\`: ${err.toString()}`, status: 401 };
          })
      })
    ));
  }

  const [SharedModules, Middlewares, LayoutModules] = await Promise.all(loadPromises);

  // Instantiate shared modules
  dependencies = SharedModules.reduce(
    (acc, Dependencies, index) => {
      if (!Dependencies) return acc
      return Dependencies({ ...acc })
    },
    // Initial dependencies
    {
      url,
      env, ...dependencies, LayoutModules,
      indexHtml: indexHtmlFiles?.slice(-1)?.[0]?.content,
      layoutUrls: bundledLayouts?.map(file => file.path),
      bundledLayouts: bundledLayouts?.map(file => file.content),
      bundledModule: bundledModule?.content
    }
  );

  const middlewares = (req) => Middlewares.reduce(
    (acc, Middleware, index) => {
      if (!Middleware) return acc
      Object.assign(Middleware, { ...middlewares })
      return Middleware({ ...acc })
    }, req
  );

  try {
    // Load target module
    const ESModule = await import(importUrl).then(mod => mod).catch(err => {
      throw {
        message: `Error Importing Module \`${importUrl}\`: ${err.toString()}`.replaceAll(new URL(importUrl).origin, ''),
        status: 401
      };
    });

    // Check if module is not found
    if (typeof ESModule === "string") throw { message: "Module Not Found", status: 404 };

    // Destructure module methods and exported properties
    const { default: mod, GET, POST, PUT, DELETE, _matchPath: matchedPath, config } = ESModule;

    // Check if module is not a function. If not, return error
    if (
      typeof mod !== "function" &&
      typeof GET !== "function" &&
      typeof POST !== "function" &&
      typeof PUT !== "function" &&
      typeof DELETE !== "function"
    ) {
      throw { message: 'Expected ESModule to export one of the following functions: ["default", "GET", "POST", "PUT", "DELETE"]. Found none.', status: 404 };
    }

    // Return module and its dependencies
    return {
      mod,
      GET,
      POST,
      PUT,
      DELETE,
      matchedPath,
      dependencies,
      middlewares,
      config
    };
  } catch (err) {
    console.log(err);
    throw err;
  }
};