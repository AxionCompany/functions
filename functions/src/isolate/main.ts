// moduleExecutor.ts
import moduleLoader from "./utils/moduleLoader.ts";
import { withHooks as withHooksWrapper } from "../utils/withHooks.ts";

/* =============================
   Type Definitions
   ============================= */

export interface LoaderConfig {
  loader?: LoaderFunction;
  functionsDir: string;
  dependencies?: Dependencies;
  url: string;
  importUrl: string;
  env?: any;
  isJSX?: boolean;
  bustCache?: boolean;
}

export type LoaderFunction = (config: {
  importUrl: string;
  url: string;
  env?: any;
  dependencies?: any;
  isJSX?: boolean;
  functionsDir: string;
  bustCache?: boolean;
}) => Promise<ModuleLoaderResult>;

export interface ModuleLoaderResult {
  mod: ModuleFunction;
  GET?: ModuleFunction;
  POST?: ModuleFunction;
  PUT?: ModuleFunction;
  DELETE?: ModuleFunction;
  matchedPath?: string;
  middlewares: MiddlewareFunction;
  beforeRun?: HookFunction;
  afterRun?: HookFunction;
  dependencies: Dependencies;
  config?: any;
  [key: string]: any;
}

export type ModuleFunction = (args: any, response?: ResponseHandler | null) => Promise<any>;
export type MiddlewareFunction = (data: RequestData, response: ResponseHandler | null) => Promise<RequestData>;
export type HookFunction = (...args: any[]) => any;

export interface Dependencies {
  [key: string]: any;
  withHooks?: <T>(
    fn: (...args: any[]) => T
  ) => (...args: any[]) => T | Promise<T>;
  withHook?: Function;
  LayoutModules?: any[];
  React?: any;
  ReactDOMServer?: any;
  DOMParser?: { new(): any };
  indexHtml?: string;
  layoutUrls?: string[];
  bundledLayouts?: string[];
  bundledModule?: string;
  postCssConfig?: any;
  processCss?: (config: any, html: string, importUrl: string) => Promise<string>;
  withCache?: <T>(fn: (...args: any[]) => Promise<T>, options: CacheOptions, ...args: any[]) => Promise<T>;
  htmlScripts?: (params: HtmlScriptParams) => HtmlScripts;
  env?: { ENV?: string };
  config?: { isFactory?: boolean; sharedModules?: any };
}

export interface CacheOptions {
  keys: string[];
  useCache: boolean;
  bustCache: boolean;
  cachettl: number;
}

export interface HtmlScriptParams {
  url: string;
  props: any;
  layoutUrls: string[];
  environment: string;
  shared: any;
}

export interface HtmlScripts {
  headScripts: ScriptData[];
  bodyScripts: ScriptData[];
}

export interface ScriptData {
  content: string;
  type: string;
}

export interface RequestData {
  data?: any;
  formData?: any;
  queryParams?: any;
  url: string;
  method: string;
  body?: any;
  params?: any;
  headers?: Record<string, string>;
  __requestId__?: string;
  _forceResponse?: any;
  [key: string]: any;
}

export interface ResponseHandler {
  status: (code: number) => void;
  statusText: (text: string) => void;
  headers: (headers: Record<string, string>) => void;
  stream: (chunk: string) => void;
}

export interface ModuleInstanceOptions {
  mod: ModuleFunction;
  params: any;
  dependencies: Dependencies;
  url: string;
  importUrl: string;
  isJSX?: boolean;
  functionsDir: string;
  bustCache: boolean;
}

/* =============================
   Helper Functions
   ============================= */

/**
 * Tries to parse JSON; if it fails, returns the original value.
 */
const tryParseJSON = (value: any): any => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

/**
 * Merges request parameters from different sources.
 */
const extractRequestParams = (requestData: RequestData): any => ({
  ...requestData.data,
  ...requestData.formData,
  ...requestData.queryParams,
});

/**
 * Returns a helper that wraps functions with before/after hooks.
 */
function createWithHooks(
  dependencies: Dependencies,
  beforeRun?: HookFunction,
  afterRun?: HookFunction
) {
  return function withHooks<T>(fn: (...args: any[]) => T): (...args: any[]) => T | Promise<T> {
    return withHooksWrapper.bind(dependencies)(fn, {
      before: beforeRun?.bind(dependencies),
      after: afterRun?.bind(dependencies),
    });
  };
};

/* =============================
   Module Instance Executor
   ============================= */

const executeModuleInstance = async (
  {
    mod,
    params,
    dependencies,
    url,
    importUrl,
    isJSX,
    functionsDir,
    bustCache,
  }: ModuleInstanceOptions,
  response: ResponseHandler | null
): Promise<any> => {
  let workerResponse: any;
  try {
    // Extract headers, requestId, body and the remaining parameters
    const { headers, __requestId__, body, ...otherParams } = params;
    const executionParams = otherParams;

    let decoratedModule: any;
    if (dependencies?.config?.isFactory) {
      // Execute the factory–style module
      decoratedModule = await mod({ ...dependencies, ...executionParams }, response);
      if (dependencies.withHooks) {
        decoratedModule = dependencies.withHooks(decoratedModule);
      }
    } else {
      // Bind withHook to add context if available
      if (dependencies.withHooks) {
        decoratedModule = dependencies.withHooks.bind(
          { ...dependencies, body, headers, __requestId__, url }
        )(
          mod.bind({ ...dependencies, body, headers, __requestId__, url })
        );
      } else {
        decoratedModule = mod.bind({ ...dependencies, body, headers, __requestId__, url });
      }
    }

    if (isJSX) {
      // === JSX / SSR Flow ===
      Object.assign(decoratedModule, { response });
      response?.headers({ "content-type": "text/html; charset=utf-8" });

      const Layout = dependencies.LayoutModules?.reduce(
        (AccumulatedLayout: any, CurrentLayout: any) => {
          if (!CurrentLayout) return AccumulatedLayout;
          return (props: any) =>
            dependencies.React.createElement(
              AccumulatedLayout,
              props,
              CurrentLayout(props)
            );
        },
        ({ children }: any) => children
      );

      // Remove headers from execution params if present
      const { headers: _ignore, ...pageParams } = executionParams;

      // Render the component to an HTML string
      const jsxHtml = dependencies.ReactDOMServer.renderToString(
        dependencies.React.createElement(
          Layout,
          pageParams,
          dependencies.React.createElement(decoratedModule, pageParams)
        )
      );

      // Parse the HTML template using the DOMParser
      const domParser = new dependencies.DOMParser();
      const document = domParser.parseFromString(dependencies.indexHtml, "text/html");

      let mainElement = document.body.querySelector("main");
      if (!mainElement) {
        mainElement = document.createElement("main");
        mainElement.innerHTML = jsxHtml;
        document.body.appendChild(mainElement);
      } else {
        mainElement.innerHTML = jsxHtml;
      }

      const compiledHtml = [dependencies.bundledLayouts.join("\n"), dependencies.bundledModule].join("\n");

      // Process CSS if available
      let cssContent = "";
      let completeCssPromise: Promise<string> | undefined;
      if (dependencies.postCssConfig && dependencies.processCss) {
        cssContent = await dependencies.processCss(dependencies.postCssConfig, jsxHtml, importUrl);
        completeCssPromise = dependencies.withCache
          ? dependencies.withCache(
            dependencies.processCss,
            {
              keys: ["css", importUrl],
              useCache: true,
              bustCache,
              cachettl: 1000 * 60 * 60 * 24,
            },
            dependencies.postCssConfig,
            compiledHtml,
            importUrl
          )
          : undefined;
      }

      // Inject CSS into a <style> tag in the head
      const styleElement = document.createElement("style");
      styleElement.textContent = cssContent;
      document.head.appendChild(styleElement);

      // Build and inject head/body scripts
      const { headScripts, bodyScripts } = dependencies.htmlScripts({
        url,
        props: pageParams,
        layoutUrls: dependencies.layoutUrls.map((layoutUrl: string) =>
          layoutUrl.replace(`${functionsDir}/`, "")
        ),
        environment: dependencies.env?.ENV || "production",
        shared: dependencies.config?.sharedModules,
      });

      headScripts.forEach((script: ScriptData) => {
        const scriptEl = document.createElement("script");
        scriptEl.innerHTML = script.content;
        scriptEl.type = script.type;
        document.head.appendChild(scriptEl);
      });
      bodyScripts.forEach((script: ScriptData) => {
        const scriptEl = document.createElement("script");
        scriptEl.innerHTML = script.content;
        scriptEl.type = script.type;
        document.body.appendChild(scriptEl);
      });

      workerResponse = document.toString();

      // Optionally stream additional CSS if available
      if (completeCssPromise) {
        const bodyCloseIndex = workerResponse.indexOf("</body>");
        if (bodyCloseIndex !== -1) {
          const preBodyCloseContent = workerResponse.slice(0, bodyCloseIndex);
          response?.stream(preBodyCloseContent + "\n");
          const additionalCss = await completeCssPromise;
          if (additionalCss) {
            response?.stream(`
              <script>
                const style = document.querySelector('style');
                style.textContent += ${JSON.stringify(additionalCss)};
              </script>
            `);
          }
          const postBodyContent = workerResponse.slice(bodyCloseIndex);
          response?.stream(postBodyContent + "\n");
        }
      } else {
        response?.stream(workerResponse + "\n");
      }
      return;
    } else {
      // === Non–JSX Flow ===
      workerResponse = await decoratedModule({ ...executionParams }, response);
    }

    return workerResponse;
  } catch (error) {
    throw error;
  }
};

/* =============================
   Main Module Executor Factory
   ============================= */

/**
 * Loads the target module and returns an execute function.
 */
export default async function createModuleExecutor(
  config: LoaderConfig
): Promise<(data: RequestData, response?: ResponseHandler | null) => Promise<any>> {
  const {
    loader = moduleLoader,
    functionsDir,
    dependencies: remoteDependencies,
    url,
    importUrl,
    env,
    isJSX,
    bustCache: initialBustCache = false,
  } = config;

  // Load the module and its associated assets
  const moduleResult: ModuleLoaderResult = await loader({
    importUrl,
    url,
    env,
    dependencies: remoteDependencies,
    isJSX,
    functionsDir,
    bustCache: initialBustCache,
  });

  const {
    mod: defaultModule,
    GET,
    POST,
    PUT,
    DELETE,
    middlewares,
    beforeRun,
    afterRun,
    dependencies,
    ...moduleExports
  } = moduleResult;

  /**
   * Executes the module based on the incoming request.
   */
  const execute = async (
    requestData: RequestData,
    response: ResponseHandler | null = null
  ): Promise<any> => {
    try {

      // Merge parameters from the request body, form and query string
      requestData.params = extractRequestParams(requestData);

      // Execute middleware chain
      const processedRequest = await middlewares.bind(dependencies)(requestData, response);
      if (processedRequest._forceResponse) {
        return processedRequest._forceResponse;
      }

      // Optionally merge middleware properties into dependencies
      // Object.assign(dependencies, { ...middlewares });

      const { method, body, params, headers: requestHeaders, __requestId__ } = processedRequest;

      // Attach the hooks helper to dependencies
      dependencies.withHooks = createWithHooks({ ...dependencies, __requestId__ }, beforeRun, afterRun);

      // Ensure module configuration exists
      moduleExports.config = moduleExports.config || {};

      // Map HTTP methods to corresponding module exports
      const methodModules: Record<string, ModuleFunction> = { GET, POST, PUT, DELETE };
      const normalizedMethod = method.toUpperCase();
      const selectedModule = methodModules[normalizedMethod] || defaultModule;

      if (!selectedModule) {
        response?.status(404);
        response?.statusText("Module not found");
        return "Module Not Found";
      }

      const executionParams = { headers: requestHeaders, body, ...params, __requestId__ };

      // Execute the module instance (JSX or regular)
      const workerResult = await executeModuleInstance(
        {
          mod: selectedModule,
          params: executionParams,
          dependencies,
          url,
          importUrl,
          isJSX,
          functionsDir,
          bustCache: initialBustCache,
        },
        response
      );

      return tryParseJSON(workerResult);
    } catch (error) {
      throw error;
    }
  };

  return execute;
}
