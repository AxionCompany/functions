/**
 * Oxian.js API Server
 * 
 * This is the main entry point for the Oxian.js API server.
 * It provides a robust API framework with dynamic configuration and isolate-based execution.
 * 
 * Usage: deno run -A api.ts
 * 
 * Environment Variables:
 * - PORT: Server port (default: 9002)
 * - ENV: Environment mode ('development' or 'production')
 * - WATCH: Enable file watching in development mode
 */

import { SEPARATOR, basename, extname, join, dirname } from "jsr:@std/path@1.1.0";
import { ensureDir } from "jsr:@std/fs@1.0.18";

// Import server components
import createServer, { type RequestHandler } from "./functions/src/server/main.ts";
import Proxy from "./functions/src/proxy/main.ts";
import getEnv, { type EnvVars } from "./functions/src/utils/environmentVariables.ts";
import replaceTemplate from "./functions/src/utils/template.ts";
import { logDebug, logError, logInfo, setLogConfig } from "./functions/src/utils/logger.ts";
import { initializeUpgradeManager } from "./functions/src/utils/upgradeManager.ts";
import { ModuleLoader } from "./functions/src/isolate-v2/loader.ts";
import defaultDenoConfig from "./deno.json" with { type: "json" };
import type { PermissionsConfig } from "./functions/src/proxy/utils/runOptions.ts";



export interface OxianConfig {

  /** Functions directory */
  functionsDir?: string;
  /** Directory entrypoint */
  dirEntrypoint?: string;
  /** Loader URL */
  loaderUrl?: string;

  /** Database configuration */
  database?: {
    enabled: boolean;
    remoteURL?: string;
    lwwColumn?: string;
    edgeId?: string;
  };

  /** Loader configuration */
  loaderConfig?: {
    username?: string;
    password?: string;
    [key: string]: any;
  };

  /** Debug logging flag */
  debugLogs?: boolean;
  /** Error logging flag */
  errorLogs?: boolean;
  /** Info logging flag */
  infoLogs?: boolean;
  /** Warning logging flag */
  warningLogs?: boolean;
  /** Permissions configuration */
  permissions?: Partial<PermissionsConfig>;

  /** Any additional properties */
  [key: string]: any;
}

/**
 * Dynamic Oxian config input interface
 */
export interface DynamicOxianConfigInput {
  /** Request URL */
  url: string;
  /** Request headers */
  headers: Headers;
  /** Environment variables */
  env: Record<string, string>;
  /** Loader configuration */
}

/**
 * Dynamic Oxian config output interface
 */
export interface DynamicOxianConfigOutput extends OxianConfig, DynamicOxianConfigInput {
  /** Isolate type */
  isolateType?: 'worker' | 'subprocess';
  /** Maximum idle time for isolates in milliseconds */
  isolateMaxIdleTime?: number;
  /** Current isolate ID */
  currentIsolateId?: string;
  /** Function to map file paths to isolate IDs */
  mapFilePathToIsolateId?: ((params: { formattedFileUrl: string, fileUrl?: string }) => string) | null;
}

// Worker environment error handling
// @ts-ignore: self is defined in worker environments
if (typeof self !== 'undefined' && 'postMessage' in self) {
  // @ts-ignore: self is defined in worker environments
  self.addEventListener("unhandledrejection", async (event) => {
    // Prevent this being reported (Firefox doesn't currently respect this)
    event.preventDefault();
    logError('API UNHANDLED ERROR', event);

    // Report error to parent
    // @ts-ignore: self is defined in worker environments
    self.postMessage({
      message: event.reason.message,
      stack: event.reason.stack,
    });
  });
}


interface DenoConfig {
  imports: Record<string, string>;
  scopes?: Record<string, Record<string, string>>;
  [key: string]: any;
}

/**
 * Oxian config data interface
 */
interface OxianConfigData {
  url: string;
  headers: Headers;
  env: EnvVars;
  loaderConfig?: {
    username?: string;
    password?: string;
    [key: string]: any;
  };
  database?: {
    enabled: boolean;
    remoteURL?: string;
    lwwColumn?: string;
    edgeId?: string;
  };
  [key: string]: any;
}

/**
 * Main application state
 */
let oxianConfigModule: ((config: DynamicOxianConfigInput) => Promise<DynamicOxianConfigOutput> | DynamicOxianConfigOutput) | null = null;

// Configuration caches
const oxianConfigs = new Map<string, OxianConfig>();
const denoConfigs = new Map<string, DenoConfig>();

/**
 * Main application initialization
 */
(async () => {
  // Load environment variables
  const env = await getEnv();

  // Configure logging based on environment
  setLogConfig({
    debugLogs: env.DEBUG === 'true',
    errorLogs: true,
    infoLogs: env.INFO === 'true',
    warningLogs: true
  });

  // Initialize upgrade manager
  initializeUpgradeManager({
    env: env.ENV || 'development',
    projectPath: Deno.cwd()
  });

  // Create and start the server
  await createServer({
    requestHandler: createRequestHandler(env),
    config: {
      port: parseInt(env.PORT || '9002', 10),
    }
  });

  // Signal successful startup
  // @ts-ignore: self is defined in worker environments
  if (typeof self !== 'undefined' && 'postMessage' in self) {
    // @ts-ignore: self is defined in worker environments
    self.postMessage({ message: { 'status': 'ok' } });
  }

  logInfo('Server started successfully');
})();

/**
 * Creates the main request handler
 * 
 * @param env - Environment variables
 * @returns A request handler function
 */
function createRequestHandler(env: EnvVars): RequestHandler {
  return async (req: Request): Promise<Response> => {
    // Log request in debug mode
    logDebug('Received request in API from', req.url);

    // Set up file loader URL
    const fileLoaderUrl = new URL(env.FILE_LOADER_URL || "http://localhost:9000");

    // Normalize functions directory path
    let functionsDir = env.FUNCTIONS_DIR || ".";
    if (functionsDir.endsWith('/')) {
      functionsDir = functionsDir.slice(0, -1);
    }

    // Initialize dynamic oxian config data
    const requestData: DynamicOxianConfigInput = {
      url: req.url,
      headers: req.headers,
      env
    };

    let oxianConfigJson: OxianConfig = {
      functionsDir,
      dirEntrypoint: env.DIR_ENTRYPOINT || "index",
      loaderUrl: fileLoaderUrl.href,
      database: {
        enabled: false,
        remoteURL: '',
        lwwColumn: '',
        edgeId: '',
      }
    };

    // Load oxian config if not already loaded
    if (!oxianConfigModule) {
      logDebug('Loading Oxian Config', new URL(`./oxian.config.ts`, fileLoaderUrl).href);

      try {
        console.log('Loading Oxian Config', new URL(`./oxian.config.ts`, fileLoaderUrl).href);
        
        // Create ModuleLoader instance for handling remote imports
        const moduleLoader = new ModuleLoader({
          projectPath: functionsDir,
          loaderUrl: fileLoaderUrl.href
        });

        // Create minimal config for ModuleLoader calls
        const minimalConfig = {
          projectId: 'api',
          projectPath: functionsDir,
          isolateId: 'api',
          env: {},
          loaderUrl: fileLoaderUrl.href,
        };

        const [
          _oxianConfigJson,
          oxianConfigESModule,
          legacyOxianConfigESModule
        ] = await Promise.all([
          // Load JSON config using fetch (ModuleLoader doesn't handle JSON)
          fetch(new URL(`oxian.config.json`, fileLoaderUrl).href)
            .then(res => res.json())
            .then(json => ({ default: json }))
            .catch(() => ({ default: {} })),
          // Load TypeScript config using ModuleLoader
          moduleLoader.load(new URL(`oxian.config.ts`, fileLoaderUrl).href, false, minimalConfig),
          // Load legacy adapters using ModuleLoader
          moduleLoader.load(new URL(`${functionsDir}/adapters`, fileLoaderUrl).href, false, minimalConfig)
            .catch(() => ({ default: null })) // Graceful fallback for missing adapters
        ]);

        oxianConfigJson = _oxianConfigJson.default || {};

        if (legacyOxianConfigESModule.default) {
          console.warn('[WARNING] Adapters are deprecated and going to be removed in version 1.0.0. Please use `oxian.config.ts` at the root of your project instead.');
        }
        oxianConfigModule = oxianConfigESModule.default || legacyOxianConfigESModule.default || oxianConfigModule;
      } catch (err) {
        logError(
          `Error trying to load oxian config: ${err instanceof Error ? err.message : String(err)}`
            .replaceAll(new URL(functionsDir, fileLoaderUrl).href, '')
        );
        // Default config just passes through the data
        oxianConfigModule = (a: OxianConfigData) => a;
      }
    }

    // Apply dynamic oxian config to the request data
    let dynamicOxianConfigOutput: DynamicOxianConfigOutput | null = null;
    try {
      if (oxianConfigModule) {
        dynamicOxianConfigOutput = await oxianConfigModule({ ...requestData, ...oxianConfigJson });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const errorStatus = (err instanceof Error && 'status' in err) ?
        (err as any).status || 500 : 500;

      logError('Oxian Config error:', errorMessage);

      return new Response(
        JSON.stringify({
          error: {
            message: errorMessage,
            status: errorStatus
          }
        }),
        {
          status: errorStatus,
          headers: { 'content-type': 'application/json; charset=utf-8' }
        }
      );
    }

    // Extract oxian config configuration
    const { loaderConfig, ...restOxianConfigData } = dynamicOxianConfigOutput || oxianConfigJson;

    // Configure file loader URL authentication
    if (loaderConfig?.username) {
      fileLoaderUrl.username = loaderConfig.username;
    } else {
      fileLoaderUrl.username = 'local';
    }

    if (loaderConfig?.password) {
      fileLoaderUrl.password = loaderConfig.password;
    }

    // Load Oxian configuration if not cached
    const requestOrigin = new URL(req.url).origin;
    let localOxianConfig: OxianConfig = oxianConfigs.get(requestOrigin) || {};

    if (!Object.keys(localOxianConfig).length) {
      try {
        const response = await fetch(new URL('oxian.config.json', fileLoaderUrl).href);
        localOxianConfig = await response.json();
      } catch {
        localOxianConfig = {};
      }

      oxianConfigs.set(requestOrigin, localOxianConfig);
    }

    // Apply configuration
    functionsDir = localOxianConfig?.functionsDir || functionsDir;

    // Load Deno configuration if not cached
    let denoConfig = denoConfigs.get(requestOrigin);

    if (!denoConfig) {
      // Initialize empty config
      denoConfig = { imports: {}, scopes: {} };

      // Try to load deno.json or deno.jsonc
      let denoConfigLoaded = false;

      // First try deno.json
      try {
        const response = await fetch(new URL('deno.json', fileLoaderUrl).href);
        if (response.ok) {
          const loadedConfig = await response.json();

          // Ensure imports and scopes exist
          denoConfig.imports = loadedConfig.imports || {};
          denoConfig.scopes = loadedConfig.scopes || {};

          // Copy other properties
          Object.assign(denoConfig, loadedConfig);
          denoConfigLoaded = true;
          logDebug('Loaded deno.json configuration');
        }
      } catch (err) {
        logDebug('Error loading deno.json:', err instanceof Error ? err.message : String(err));
      }

      // If deno.json failed, try deno.jsonc
      if (!denoConfigLoaded) {
        try {
          const response = await fetch(new URL('deno.jsonc', fileLoaderUrl).href);
          if (response.ok) {
            // For jsonc, we need to parse it manually to handle comments
            const jsonText = await response.text();
            // Remove comments (both // and /* */ style)
            const jsonWithoutComments = jsonText
              .replace(/\/\/.*$/gm, '') // Remove single line comments
              .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments

            const loadedConfig = JSON.parse(jsonWithoutComments);

            // Ensure imports and scopes exist
            denoConfig.imports = loadedConfig.imports || {};
            denoConfig.scopes = loadedConfig.scopes || {};

            // Copy other properties
            Object.assign(denoConfig, loadedConfig);
            denoConfigLoaded = true;
            logDebug('Loaded deno.jsonc configuration');
          }
        } catch (err) {
          logDebug('Error loading deno.jsonc:', err instanceof Error ? err.message : String(err));
        }
      }

      // Try to load package.json for Node.js dependencies
      try {
        const response = await fetch(new URL('package.json', fileLoaderUrl).href);
        if (response.ok) {
          const nodeConfig = await response.json();

          // Convert Node.js dependencies to Deno imports
          if (nodeConfig.dependencies) {
            Object.entries(nodeConfig.dependencies).forEach(([key, value]) => {
              const depValue = String(value);

              if (depValue.startsWith('http') ||
                depValue.startsWith('file') ||
                depValue.startsWith('npm:') ||
                depValue.startsWith('node:')) {
                denoConfig!.imports[key] = depValue;
              } else {
                denoConfig!.imports[key] = `npm:${key}@${depValue}`;
              }
            });
          }
          logDebug('Loaded package.json dependencies');
        }
      } catch (err) {
        logDebug('Error loading package.json:', err instanceof Error ? err.message : String(err));
      }

      // Cache the config
      denoConfigs.set(requestOrigin, denoConfig);
    }

    // Merge with Oxian's default Deno config
    // @ts-ignore: defaultDenoConfig.imports exists
    denoConfig.imports = { ...defaultDenoConfig.imports, ...denoConfig.imports };

    // Merge scopes if they exist
    const oxianScopes = (defaultDenoConfig as any).scopes;
    if (oxianScopes && denoConfig.scopes) {
      denoConfig.scopes = { ...oxianScopes, ...denoConfig.scopes };
    } else if (oxianScopes) {
      denoConfig.scopes = { ...oxianScopes };
    }

    // Create and return the proxy response
    // Note: The isolate-specific upgrade check will be done in the proxy
    return Proxy({
      config: {
        loaderUrl: fileLoaderUrl.href,
        dirEntrypoint: env.DIR_ENTRYPOINT || "index",
        functionsDir,
        ...localOxianConfig,
        denoConfig,
        ...restOxianConfigData,
      },
      modules: {
        path: { SEPARATOR, basename, extname, join, dirname },
        template: replaceTemplate,
        fs: { ensureDir }
      },
    })(req);
  };
}



