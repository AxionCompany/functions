import getAllFiles from "./getAllFiles.ts";

export default async ({ currentUrl, env, importUrl, dependencies, isJSX }: any) => {

  let layoutUrls = [];
  let resolvedJsxData: any = [];
  const bundleUrl = new URL(importUrl);
  bundleUrl.searchParams.append('bundle', true);

  const importPromises = [];

  // Get shared module bundles
  importPromises.push(getAllFiles({
    url: importUrl,
    name: 'shared',
    extensions: ['js', 'ts'],
  }));

  // Get module bundle 
  importPromises.push(fetch(bundleUrl.href).then(res => res.json()).catch(err => console.log(err.toString)));

  if (isJSX) {
    // get index.html files
    importPromises.push(getAllFiles({ url: importUrl, name: 'index', extensions: ['html'], returnProp: 'content' }));
    // Get Layout Bundles
    importPromises.push(getAllFiles({ url: bundleUrl, name: 'layout', extensions: ['jsx', 'tsx'] }));
  }

  // Await all import promises
  const [bundledSharedModules, bundledModule, indexHtmlFiles, bundledLayouts] = await Promise.all(importPromises);

  const loadPromises = [];

  // Load shared modules
  loadPromises.push(Promise.all(
    bundledSharedModules.map((file) => {
      // return import(`data:application/javascript,${file.content}`)
      return import(new URL(`/${file?.matchPath}`, importUrl).href)
        .then((mod) => mod.default)
        .catch(err => {
          console.log(`Error Importing Shared Module \`${file?.matchPath}\`: ${err.toString()}`);
          throw { message: `Error Importing Shared Module \`${file?.matchPath}\`: ${err.toString()}`, status: 401 };
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

  const [SharedModules, LayoutModules] = await Promise.all(loadPromises);

  // Instantiate shared modules
  dependencies = SharedModules.reduce(
    (acc, Dependencies, index) => {
      if (!Dependencies) return acc
      return Dependencies({ ...acc })
    },
    // Initial dependencies
    {
      env, ...dependencies, LayoutModules,
      indexHtml: indexHtmlFiles?.slice(-1)?.[0]?.content,
      layoutUrls: bundledLayouts?.map(file => file.path),
      bundledLayouts: bundledLayouts?.map(file => file.content),
      bundledModule: bundledModule.content
    }
  );

  try {
    // Load target module
    // const ESModule = await import(`data:application/javascript,${bundledModule.content}`).then(mod => mod).catch(err => {
    const ESModule = await import(new URL(`/${bundledModule?.matchPath}`, importUrl).href).then(mod => mod).catch(err => {
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
      config
    };
  } catch (err) {
    console.log(err);
    throw err;
  }
};