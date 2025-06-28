// moduleLoader.ts
import getAllFiles from "./getAllFiles.ts";
import { bundle } from "@deno/emit";
import { enhanceErrorWithSourceMap } from "./sourceMapSupport.ts";

// Cache for bundled modules to avoid re-bundling
const bundleCache = new Map<string, { code: string; sourceMap?: string; dataUrl: string }>();

/**
 * Clear the entire bundle cache (useful for debugging or forced cache busting)
 */
export function clearBundleCache(): void {
  const cacheSize = bundleCache.size;
  bundleCache.clear();
  console.log(`[Bundle Cache] Cleared entire bundle cache (${cacheSize} entries)`);
}

/**
 * Get bundle cache statistics
 */
export function getBundleCacheStats(): { size: number; keys: string[] } {
  return {
    size: bundleCache.size,
    keys: Array.from(bundleCache.keys())
  };
}

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
 * Bundles a module and returns it as a data URL for importing
 */
async function bundleModule(
  moduleUrl: string,
  importMap?: any,
  bustCache = false
): Promise<{ code: string; sourceMap?: string; dataUrl: string }> {

  // Check cache first (unless cache busting is requested)
  if (bustCache) {
    const cacheFolder = `./cache/.deno/remote/http/${new URL(moduleUrl).origin.replace(/^https?:\/\//, '').replace(/:/g, '_PORT')}`
    // check if the cache folder exists
    if (Deno.statSync(cacheFolder).isDirectory) {
      // delete the temp folder
      Deno.removeSync(cacheFolder, { recursive: true })
    }
  }

  try {
    console.log(`[Bundle] Bundling module: ${moduleUrl}`);

    const result = await bundle(moduleUrl, {
      allowRemote: true,
      compilerOptions: {
        inlineSourceMap: true,  // Enable inline source maps for automatic stack trace support
        inlineSources: true,    // Include original source code in source maps
      },
      cacheSetting: [new URL(moduleUrl).origin],
      importMap,
    });


    const { code } = result;

    // Extract source map if available (for debugging purposes)
    let sourceMap: string | undefined;
    const sourceMapMatch = code.match(/\/\/# sourceMappingURL=data:application\/json;base64,(.+)$/m);
    if (sourceMapMatch) {
      sourceMap = atob(sourceMapMatch[1]);
      console.log(`[Bundle] Generated source map for ${moduleUrl} (${sourceMap.length} bytes)`);
    }

    // Create data URL for the bundled code
    const dataUrl = `data:text/javascript;base64,${btoa(code)}`;

    const bundleResult = { code, sourceMap, dataUrl };

    // Cache the result
    console.log(`[Bundle] Successfully bundled module: ${moduleUrl} (${code.length} bytes)${sourceMap ? ' with source maps' : ''}`);

    return bundleResult;
  } catch (err) {
    console.error(`[Bundle Error] Failed to bundle module ${moduleUrl}:`, err);
    throw err;
  }
}

/**
 * Dynamically bundles and imports a list of files and returns their default exports.
 * Falls back to regular imports if bundling fails.
 */
async function dynamicImportBundledModules(
  files: FileData[],
  moduleType: string,
  importUrl: string,
  baseSearch: string,
  importMap?: any,
  bustCache = false
): Promise<any[]> {
  return Promise.all(
    files.map(async (file) => {
      const fileUrl = new URL(`/${file?.matchPath}`, importUrl);
      fileUrl.search = baseSearch;

      try {
        // Try bundling first
        const { dataUrl, code } = await bundleModule(fileUrl.href, importMap, bustCache);

        // Import from the data URL with enhanced error handling
        try {
          const mod = await import(dataUrl);
          console.log(`[Bundle Import] Successfully imported bundled ${moduleType} module: ${file?.matchPath}`);
          return mod.default;
        } catch (importError) {
          // Enhance error with source map information
          const enhancedError = enhanceErrorWithSourceMap(
            importError instanceof Error ? importError : new Error(String(importError)),
            code,
            fileUrl.href
          );
          throw enhancedError;
        }
      } catch (bundleErr) {
        console.warn(`[Bundle Fallback] Bundling failed for ${moduleType} module ${file?.matchPath}, falling back to regular import:`, bundleErr);

        // Fallback to regular import
        try {
          const mod = await import(fileUrl.href);
          console.log(`[Regular Import] Successfully imported ${moduleType} module: ${file?.matchPath}`);
          return mod.default;
        } catch (importErr) {
          const errorMessage = `Error importing ${moduleType} Module \`${file?.matchPath}\` (both bundling and regular import failed): ${importErr instanceof Error ? importErr.message : String(importErr)}`;
          console.error(errorMessage);
          throw { message: errorMessage, status: 401 };
        }
      }
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

  console.log(`[ModuleLoader] Starting module load for ${importUrl}`);
  console.log(`[ModuleLoader] BustCache flag: ${bustCache}`);
  console.log(`[ModuleLoader] Current bundle cache size: ${bundleCache.size}`);

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

  // Extract import map from dependencies if available
  const importMap = dependencies?.denoConfig?.imports ? {
    imports: dependencies.denoConfig.imports,
    scopes: dependencies.denoConfig.scopes || {}
  } : undefined;

  // Load shared modules.
  loadPromises.push(dynamicImportBundledModules(sharedModulesData, "Shared", importUrl, importUrlObj.search, importMap, bustCache));

  // Load middleware modules.
  loadPromises.push(dynamicImportBundledModules(middlewaresData, "Middleware", importUrl, importUrlObj.search, importMap, bustCache));

  // Load interceptor module.
  if (!interceptorData || interceptorData.length === 0) {
    loadPromises.push(Promise.resolve({}));
  } else {
    const interceptorFile = interceptorData.slice(-1)[0];
    const interceptorUrl = new URL(`/${interceptorFile.matchPath}`, importUrl);
    interceptorUrl.search = importUrlObj.search;
    loadPromises.push(
      bundleModule(interceptorUrl.href, importMap, bustCache)
        .then(({ dataUrl, code }) => {
          return import(dataUrl)
            .then((mod) => {
              console.log(`[Bundle Import] Successfully imported bundled Interceptor module: ${interceptorFile.matchPath}`);
              return mod;
            })
            .catch((importError) => {
              // Enhance error with source map information
              const enhancedError = enhanceErrorWithSourceMap(
                importError instanceof Error ? importError : new Error(String(importError)),
                code,
                interceptorUrl.href
              );
              throw enhancedError;
            });
        })
        .catch(async (bundleErr) => {
          console.warn(`[Bundle Fallback] Bundling failed for Interceptor module ${interceptorFile.matchPath}, falling back to regular import:`, bundleErr);

          // Fallback to regular import
          try {
            const mod = await import(interceptorUrl.href);
            console.log(`[Regular Import] Successfully imported Interceptor module: ${interceptorFile.matchPath}`);
            return mod;
          } catch (importErr) {
            const errorMessage = `Error importing Interceptor Module \`${interceptorFile.matchPath}\` (both bundling and regular import failed): ${importErr instanceof Error ? importErr.message : String(importErr)}`;
            console.error(errorMessage);
            throw { message: errorMessage, status: 401 };
          }
        })
    );
  }

  // Load layout modules if JSX is enabled.
  if (isJSX && bundledLayouts) {
    loadPromises.push(dynamicImportBundledModules(bundledLayouts, "Layout", importUrl, importUrlObj.search, importMap, bustCache));
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
      if (err instanceof Error) {
        console.error(`Error instantiating shared module: ${err.toString()}`);
      } else {
        console.error(`Error instantiating shared module: ${err}`);
      }
    }
  }

  // Compose the middleware executor function.
  async function middlewareExecutor(this: any, req: any, response: any): Promise<MiddlewareFunction> {
    let currentReq = req;
    for (const Middleware of Middlewares) {
      if (Middleware) {
        const middlewareResult = await Middleware.bind(this)(currentReq, response);
        currentReq = middlewareResult;
      }
    }
    return currentReq;
  };

  const { beforeRun, afterRun } = InterceptorModule || {};

  try {
    // Bundle and dynamically import the target module.
    let targetModule;
    try {
      const { dataUrl, code } = await bundleModule(importUrl, importMap, bustCache);
      try {
        targetModule = await import(dataUrl);
        console.log(`[Bundle Import] Successfully imported bundled target module: ${importUrl}`);
      } catch (importError) {
        // Enhance error with source map information
        const enhancedError = enhanceErrorWithSourceMap(
          importError instanceof Error ? importError : new Error(String(importError)),
          code,
          importUrl
        );
        throw enhancedError;
      }
    } catch (bundleErr) {
      console.warn(`[Bundle Fallback] Bundling failed for target module ${importUrl}, falling back to regular import:`, bundleErr);

      // Fallback to regular import
      targetModule = await import(importUrl);
      console.log(`[Regular Import] Successfully imported target module: ${importUrl}`);
    }

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