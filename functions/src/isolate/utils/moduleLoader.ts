// moduleLoader.ts
import getAllFiles from "./getAllFiles.ts";

interface ModuleLoaderParams {
  url: string;
  env: any;
  importUrl: string;
  dependencies: any;
  isJSX?: boolean;
  functionsDir: string;
  bustCache?: boolean;
}

export interface FileData {
  matchPath: string;
  path?: string;
  content?: string;
}

export type ModuleFunction = (args: any, response?: any) => Promise<any>;
export type MiddlewareFunction = (req: any, response: any) => Promise<any>;
export type HookFunction = (...args: any[]) => any;

export interface ModuleLoaderResult {
  mod: ModuleFunction;
  GET?: ModuleFunction;
  POST?: ModuleFunction;
  PUT?: ModuleFunction;
  DELETE?: ModuleFunction;
  matchedPath?: string;
  dependencies: any;
  middlewares: MiddlewareFunction;
  beforeRun?: HookFunction;
  afterRun?: HookFunction;
  config?: any;
}

/**
 * Helper to build a new URL with appended query parameters.
 */
function buildUrlWithParams(baseUrl: URL, params: Record<string, string | boolean>): URL {
  const newUrl = new URL(baseUrl.toString());
  Object.entries(params).forEach(([key, value]) => {
    newUrl.searchParams.append(key, value.toString());
  });
  return newUrl;
}

/**
 * Dynamically imports a list of files and returns their default exports.
 */
async function dynamicImportModules(
  files: FileData[],
  moduleType: string,
  importUrl: string,
  baseSearch: string
): Promise<any[]> {
  return Promise.all(
    files.map((file) => {
      const fileUrl = new URL(`/${file?.matchPath}`, importUrl);
      fileUrl.search = baseSearch;
      return import(fileUrl.href)
        .then((mod) => mod.default)
        .catch((err) => {
          const errorMessage = `Error Importing ${moduleType} Module \`${file?.matchPath}\`: ${err.toString()}`;
          console.error(errorMessage);
          throw { message: errorMessage, status: 401 };
        });
    })
  );
}

/**
 * Main module loader.
 */
export default async function moduleLoader({
  url,
  env,
  importUrl,
  dependencies,
  isJSX,
  functionsDir,
  bustCache,
}: ModuleLoaderParams): Promise<ModuleLoaderResult> {
  // Convert importUrl to URL instance for consistency.

  const importUrlObj = new URL(importUrl);

  const importPromises: Promise<any>[] = [];

  // Get shared module bundles.
  importPromises.push(
    getAllFiles({
      url: importUrl,
      name: "shared",
      extensions: ["js", "ts"],
    })
  );

  // Get middleware modules.
  importPromises.push(
    getAllFiles({
      url: importUrl,
      name: "middleware",
      extensions: ["js", "ts"],
    })
  );

  // Get interceptor modules.
  importPromises.push(
    getAllFiles({
      url: importUrl,
      name: "interceptor",
      extensions: ["js", "ts"],
    })
  );

  // Prepare URL for bundled module.
  const bundleUrlObj = new URL(importUrl);
  bundleUrlObj.searchParams.append("bundle", "true");
  if (bustCache) {
    bundleUrlObj.searchParams.append("bustCache", bustCache.toString());
  }

  if (isJSX) {
    // Get module bundle.
    importPromises.push(
      fetch(bundleUrlObj.href)
        .then((res) => res.json())
        .catch((err) => {
          console.error(err.toString());
          return null;
        })
    );
    // Get index.html files.
    importPromises.push(
      getAllFiles({
        url: importUrl,
        name: "index",
        extensions: ["html"],
        returnProp: "content",
      })
    );
    // Get Layout Bundles.
    importPromises.push(
      getAllFiles({
        url: bundleUrlObj.toString(),
        name: "layout",
        extensions: ["jsx", "tsx"],
      })
    );
  }

  const [
    sharedModulesData,
    middlewaresData,
    interceptorData,
    bundledModule,
    indexHtmlFiles,
    bundledLayouts,
  ] = await Promise.all(importPromises);

  const loadPromises: Promise<any>[] = [];

  // Load shared modules.
  loadPromises.push(dynamicImportModules(sharedModulesData, "Shared", importUrl, importUrlObj.search));

  // Load middleware modules.
  loadPromises.push(dynamicImportModules(middlewaresData, "Middleware", importUrl, importUrlObj.search));

  // Load interceptor module.
  if (!interceptorData || interceptorData.length === 0) {
    loadPromises.push(Promise.resolve({}));
  } else {
    const interceptorFile = interceptorData.slice(-1)[0];
    const interceptorUrl = new URL(`/${interceptorFile.matchPath}`, importUrl);
    interceptorUrl.search = importUrlObj.search;
    loadPromises.push(
      import(interceptorUrl.href)
        .then((mod) => mod)
        .catch((err) => {
          const errorMessage = `Error Importing Interceptor Module \`${interceptorFile.matchPath}\`: ${err.toString()}`;
          console.error(errorMessage);
          throw { message: errorMessage, status: 401 };
        })
    );
  }

  // Load layout modules if JSX is enabled.
  if (isJSX && bundledLayouts) {
    loadPromises.push(dynamicImportModules(bundledLayouts, "Layout", importUrl, importUrlObj.search));
  }

  const [SharedModules, Middlewares, InterceptorModule, LayoutModules] = await Promise.all(loadPromises);

  // Instantiate shared modules to compose dependencies.
  let instantiatedDependencies = {
    url,
    env,
    ...dependencies,
    LayoutModules,
    indexHtml: indexHtmlFiles?.slice(-1)[0] || dependencies?.indexHtml,
    layoutUrls: bundledLayouts?.map((file: FileData) =>
      file.path ? file.path.replace(new RegExp(`^${functionsDir}/`), "") : ""
    ),
    bundledLayouts: bundledLayouts?.map((file: FileData) => file.content),
    bundledModule: bundledModule?.content,
  };

  // Process shared modules sequentially
  for (const sharedModule of SharedModules) {
    if (!sharedModule) continue;
    try {
      instantiatedDependencies = await sharedModule({ ...instantiatedDependencies });
    } catch (err) {
      console.error(`Error instantiating shared module: ${err.toString()}`);
    }
  }

  // Compose the middleware executor function.
  async function middlewareExecutor(req, response): Promise<MiddlewareFunction> {
    let currentReq = req;
    for (const Middleware of Middlewares) {
      if (Middleware) {
        // Object.assign(Middleware, { ...middlewareExecutor });
        const middlewareResult = await Middleware.bind(this)(currentReq, response);
        // Object.assign(middlewareExecutor, { ...Middleware });
        currentReq = middlewareResult;
      }
    }
    return currentReq;
  };

  const { beforeRun, afterRun } = InterceptorModule || {};

  try {
    // Dynamically import the target module.
    const targetModule = await import(importUrl)
      .then((mod) => mod)
      .catch((err) => {
        const errorMessage = `Error Importing Module \`${importUrl}\`: ${err.toString()}`.replace(new URL(importUrl).origin, "");
        throw { message: errorMessage, status: 401 };
      });

    if (typeof targetModule === "string") {
      throw { message: "Module Not Found", status: 404 };
    }

    const { default: mod, GET, POST, PUT, DELETE, _matchPath: matchedPath, config } = targetModule;

    if (
      typeof mod !== "function" &&
      typeof GET !== "function" &&
      typeof POST !== "function" &&
      typeof PUT !== "function" &&
      typeof DELETE !== "function"
    ) {
      throw {
        message:
          'Expected ESModule to export one of the following functions: ["default", "GET", "POST", "PUT", "DELETE"]. Found none.',
        status: 404,
      };
    }

    return {
      mod,
      GET,
      POST,
      PUT,
      DELETE,
      matchedPath,
      dependencies: instantiatedDependencies,
      middlewares: middlewareExecutor,
      beforeRun,
      afterRun,
      config,
    };
  } catch (err) {
    console.error(err);
    throw err;
  }
}
