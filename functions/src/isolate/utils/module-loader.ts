import { config } from "https://deno.land/x/dotenv@v3.2.2/mod.ts";
import getAllFiles from "./getAllFiles.ts";

export default async ({ importUrl, dependencies, isJSX }: any) => {

  const sharedModuleUrls = await getAllFiles({ url: importUrl, name: 'shared', extensions: ['js', 'jsx', 'ts', 'tsx'], returnProp: 'matchPath' });

  let LayoutModules = [];
  let layoutUrls = [];
  if (isJSX) {
    const indexHtml = (await getAllFiles({ url: importUrl, name: 'index', extensions: ['html'], returnProp: 'content' })).slice(-1)[0];
    indexHtml && (dependencies.indexHtml = indexHtml);
    layoutUrls = await getAllFiles({ url: importUrl, name: 'layout', extensions: ['js', 'jsx', 'ts', 'tsx'], returnProp: 'matchPath' });
    // Load layout modules
    LayoutModules = await Promise.all(
      layoutUrls.map((url) =>
        import(new URL(url, new URL(importUrl).origin).href)
          .then((mod) => mod.default)
      )
    );
  }
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
    { env: { ...Deno.env.toObject(), ...config() }, ...dependencies, LayoutModules, layoutUrls }
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
