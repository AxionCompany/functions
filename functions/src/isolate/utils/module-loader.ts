import { config } from "https://deno.land/x/dotenv@v3.2.2/mod.ts";
import getAllFiles from "./getAllFiles.ts";

export default async ({ currentUrl, importUrl, dependencies, isJSX }: any) => {

  const sharedModuleUrls = await getAllFiles({ url: importUrl, name: 'shared', extensions: ['js', 'jsx', 'ts', 'tsx'], returnProp: 'matchPath' });

  let layoutUrls = [];
  let resolvedJsxData: any = [];
  if (isJSX) {
    const indexHtml = (await getAllFiles({ url: importUrl, name: 'index', extensions: ['html'], returnProp: 'content' })).slice(-1)[0];
    indexHtml && (dependencies.indexHtml = indexHtml);
    layoutUrls = await getAllFiles({ url: importUrl, name: 'layout', extensions: ['js', 'jsx', 'ts', 'tsx'], returnProp: 'matchPath' });
    // Load layout modules
    const LayoutModulesPromise = Promise.all(
      layoutUrls.map((url) =>
        import(new URL(url, new URL(importUrl).origin).href)
          .then((mod) => mod.default)
      )
    );
    // Load layout bundles
    const bundledLayoutsPromise = getAllFiles({
      url: currentUrl + '?bundle=true',
      name: 'layout',
      extensions: ['js', 'jsx', 'ts', 'tsx'],
      returnProp: 'matchPath'
    }).then(res => Promise.all(
      res.map((url: string) => fetchDynamicImportFiles(new URL(url, currentUrl).href, import.meta.url.split('/src')[0], 10))
    ));

    // Load module bundles
    const bundledModulePromise = fetchDynamicImportFiles(currentUrl, import.meta.url.split('/src')[0], 10)
    // Await all promises
    resolvedJsxData = await Promise.all([
      LayoutModulesPromise,
      bundledLayoutsPromise,
      bundledModulePromise
    ])
  }
  const [LayoutModules, bundledLayouts, bundledModule] = resolvedJsxData;
  // Load shared modules
  const SharedModules = await Promise.all(
    sharedModuleUrls.map((url) =>
      import(new URL(url, new URL(importUrl).origin).href)
        .then((mod) => mod.default)
    )
  );

  // Instantiate shared modules
  dependencies = SharedModules.reduce(
    (acc, Dependencies, index) => {
      if (!Dependencies) return acc
      return Dependencies({ ...acc })
    },
    // Initial dependencies
    { env: { ...Deno.env.toObject(), ...config() }, ...dependencies, LayoutModules, layoutUrls, bundledLayouts, bundledModule }
  );

  try {
    // Load target module
    const ESModule = await import(importUrl).then(mod => mod).catch(console.log);

    // Check if module is not found
    if (typeof ESModule === "string") throw { message: "Module Not Found", status: 404 };

    // Destructure module methods and exported properties
    const { default: mod, GET, POST, PUT, DELETE, _pathParams: pathParams, _matchPath: matchedPath, config } = ESModule;

    // Check if module is not a function. If not, return error
    if (
      typeof mod !== "function" &&
      typeof GET !== "function" &&
      typeof POST !== "function" &&
      typeof PUT !== "function" &&
      typeof DELETE !== "function"
    ) {
      throw { message: "Imported Code should be an ESModule.", status: 404 };
    }

    // Return module and its dependencies
    return {
      mod,
      GET,
      POST,
      PUT,
      DELETE,
      pathParams,
      matchedPath,
      dependencies,
      config
    };
  } catch (err) {
    console.log(err);
    throw err;
  }
};



async function fetchDynamicImportFiles(url: string, customBaseUrl: string, maxRecursions: number) {
  // Helper function to perform GET requests with query parameters
  async function getRequest(url: string, customBaseUrl: string | null) {
    const urlWithParams = new URL(url);

    customBaseUrl && urlWithParams.searchParams.append('customBaseUrl', customBaseUrl);
    urlWithParams.searchParams.append('bundle', 'true');
    const response = await fetch(urlWithParams.toString());
    if (!response.ok) {
      throw new Error(`Failed to fetch ${urlWithParams.toString()}: ${response.statusText}`);
    }
    return response.text();
  }

  // Helper function to find importAxion statements and extract paths
  function findImportAxionPaths(code: string) {
    const regex = /importAxion\(['"]([^'"]+)['"]\)/g;
    let match;
    const paths = [];
    while ((match = regex.exec(code)) !== null) {
      paths.push(match[1]);
    }
    return paths;
  }

  // Recursive function to fetch code with a maximum recursion limit
  async function recursiveFetch(url: string, customBaseUrl: string, recursionCount: number, maxRecursions: number, combinedCode = '') {
    if (recursionCount > maxRecursions) {
      return combinedCode;
    }
    let code;
    try {
      code = await getRequest(url, recursionCount > 1 ? customBaseUrl : null);
    } catch (error) {
      console.error(error);
      return combinedCode;
    }
    combinedCode += code + '\n';
    const paths = findImportAxionPaths(code);
    for (const path of paths) {
      const newUrl = new URL(path, customBaseUrl).toString();
      combinedCode = await recursiveFetch(newUrl, customBaseUrl, recursionCount + 1, maxRecursions, combinedCode);
    }
    return combinedCode;
  }

  // Start the recursive fetching process
  return await recursiveFetch(url, customBaseUrl, 1, maxRecursions);
}