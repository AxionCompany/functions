/**
 * Axion Functions API Server
 * 
 * This is the main entry point for the Axion Functions API server.
 * It handles request routing, configuration loading, and isolate management.
 */

/// <reference lib="deno.unstable" />

import { SEPARATOR, basename, extname, join, dirname } from "https://deno.land/std/path/mod.ts";
import { ensureDir } from "https://deno.land/std@0.224.0/fs/ensure_dir.ts";

// Import server components
import createServer, { RequestHandler } from "./functions/src/server/main.ts";
import Proxy from "./functions/src/proxy/main.ts";
import getEnv, { EnvVars } from "./functions/src/utils/environmentVariables.ts";
import replaceTemplate from "./functions/src/utils/template.ts";
import { logDebug, logError, logInfo, setLogConfig } from "./functions/src/utils/logger.ts";
import axionDenoConfig from "./deno.json" with { type: "json" };

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

/**
 * Configuration cache interfaces
 */
interface AxionConfig {
  functionsDir?: string;
  dirEntrypoint?: string;
  loaderUrl?: string;
  [key: string]: any;
}

interface DenoConfig {
  imports: Record<string, string>;
  scopes?: Record<string, Record<string, string>>;
  [key: string]: any;
}

/**
 * Adapter data interface
 */
interface AdapterData {
  url: string;
  headers: Headers;
  env: EnvVars;
  loaderConfig?: {
    username?: string;
    password?: string;
    [key: string]: any;
  };
  shouldUpgradeAfter?: number;
  [key: string]: any;
}

/**
 * Main application state
 */
let adapters: ((config: AdapterData) => Promise<AdapterData> | AdapterData) | null = null;
let shouldUpgradeAfter = 0;

// Configuration caches
const axionConfigs = new Map<string, AxionConfig>();
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

  // Start file watcher if in watch mode
  if (Deno.env.get('WATCH')) {
    watchFiles(env);
  }
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

    // Initialize adapter data
    let adapterData: AdapterData = {
      url: req.url,
      headers: req.headers,
      env
    };

    // Load adapters if not already loaded
    if (!adapters) {
      logDebug('Loading Adapters', new URL(`${functionsDir}/adapters`, fileLoaderUrl).href);
      
      try {
        const adapterModule = await import(new URL(`${functionsDir}/adapters`, fileLoaderUrl).href);
        adapters = adapterModule.default;
      } catch (err) {
        logError(
          `Error trying to load adapters: ${err instanceof Error ? err.message : String(err)}`
            .replaceAll(new URL(functionsDir, fileLoaderUrl).href, '')
        );
        // Default adapter just passes through the data
        adapters = (a: AdapterData) => a;
      }
    }

    // Apply adapters to the request data
    try {
      if (adapters) {
        adapterData = await adapters(adapterData);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const errorStatus = (err instanceof Error && 'status' in err) ? 
        (err as any).status || 500 : 500;
      
      logError('Adapter error:', errorMessage);
      
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

    // Extract adapter configuration
    const { loaderConfig, shouldUpgradeAfter: newUpgradeTime, ...adaptersData } = adapterData;
    
    // Update upgrade time if provided
    if (newUpgradeTime) {
      shouldUpgradeAfter = newUpgradeTime;
    }

    // Configure file loader URL authentication
    if (loaderConfig?.username) {
      fileLoaderUrl.username = loaderConfig.username;
    } else {
      fileLoaderUrl.username = 'local';
    }
    
    if (loaderConfig?.password) {
      fileLoaderUrl.password = loaderConfig.password;
    }

    // Load Axion configuration if not cached
    const requestOrigin = new URL(req.url).origin;
    let axionConfig: AxionConfig = axionConfigs.get(requestOrigin) || {};

    if (!Object.keys(axionConfig).length) {
      try {
        const response = await fetch(new URL('axion.config.json', fileLoaderUrl).href);
        axionConfig = await response.json();
      } catch (_) {
        axionConfig = {};
      }
      
      axionConfigs.set(requestOrigin, axionConfig);
    }

    // Update functions directory from config if available
    functionsDir = axionConfig?.functionsDir || functionsDir;

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

    // Merge with Axion's default Deno config
    denoConfig.imports = { ...axionDenoConfig.imports, ...denoConfig.imports };
    
    // Handle potential type mismatch between configs
    const axionScopes = (axionDenoConfig as any).scopes;
    if (axionScopes && denoConfig.scopes) {
      denoConfig.scopes = { ...axionScopes, ...denoConfig.scopes };
    } else if (axionScopes) {
      denoConfig.scopes = { ...axionScopes };
    }

    // Create and return the proxy response
    return Proxy({
      config: {
        loaderUrl: fileLoaderUrl.href,
        dirEntrypoint: env.DIR_ENTRYPOINT || "index",
        shouldUpgradeAfter,
        functionsDir,
        ...axionConfig,
        denoConfig,
        ...adaptersData,
      },
      modules: {
        path: { SEPARATOR, basename, extname, join, dirname },
        template: replaceTemplate,
        fs: { ensureDir }
      },
    })(req);
  };
}

/**
 * Watches for file changes and triggers code upgrades
 * 
 * @param env - Environment variables
 */
async function watchFiles(env: EnvVars): Promise<void> {
  logInfo('Starting file watcher');
  
  for await (const event of Deno.watchFs("./", { recursive: true })) {
    // Only handle file modifications for relevant file types
    if (event.kind === "modify" && event.paths.some(path => /\.(html|js|jsx|tsx|ts)$/.test(path))) {
      const dir = Deno.cwd();
      const files = event.paths.map(path => path.split(dir).join(''));
      
      // Skip data/cache files to prevent infinite loops
      if (files.some(file =>
        file.indexOf('data') > -1 && (
          (file.indexOf('cache') > file.indexOf('data')) ||
          (file.lastIndexOf('data') > file.indexOf('data'))
        )
      )) continue;

      // Set upgrade time to trigger code reload
      shouldUpgradeAfter = Date.now();
      logInfo('Files modified:', files, 'upgrading code version...');
    }
  }
}



