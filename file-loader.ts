/**
 * Axion File Loader
 * 
 * This is the main entry point for the Axion File Loader server.
 * It handles file loading, caching, and configuration management for Deno modules.
 */

/// <reference lib="deno.unstable" />

import FileLoader from "./functions/src/file-loader/main.ts";
import createServer from "./functions/src/server/main.ts";
import getEnv, { EnvVars } from "./functions/src/utils/environmentVariables.ts";
import { SEPARATOR, basename, extname, join, dirname } from "https://deno.land/std/path/mod.ts";
import Cache from "./functions/src/utils/withCache.ts";
import { logDebug, logError, logInfo, logWarning, setLogConfig } from "./functions/src/utils/logger.ts";
import axionDenoConfig from "./deno.json" with { type: "json" };

/**
 * Configuration interfaces
 */
interface AxionConfig {
  dirEntrypoint?: string;
  [key: string]: any;
}

interface DenoConfig {
  imports: Record<string, string>;
  scopes?: Record<string, Record<string, string>>;
  [key: string]: any;
}

interface FileLoaderConfig {
  dirEntrypoint: string;
  debug: boolean;
  useCache: boolean;
  bustCacheAfter?: string;
  cachettl: number;
  loaderType: string;
  owner?: string;
  repo?: string;
  branch?: string;
  environment?: string;
  apiKey?: string;
  [key: string]: any;
}

interface FileLoaderModules {
  path: {
    SEPARATOR: string;
    basename: (path: string, ext?: string) => string;
    extname: (path: string) => string;
    join: (...paths: string[]) => string;
    dirname: (path: string) => string;
  };
  withCache?: any;
  [key: string]: any;
}

/**
 * Configuration caches
 */
const axionConfigs = new Map<string, AxionConfig>();
const denoConfigs = new Map<string, DenoConfig>();

/**
 * Worker environment error handling
 */
// @ts-ignore: self is defined in worker environments
if (typeof self !== 'undefined') {
  // @ts-ignore: self is defined in worker environments
  self.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    event.preventDefault();
    logError('FILE LOADER UNHANDLED ERROR', event);
  });
}

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

  // Parse cache setting
  let useCache = true;
  try {
    useCache = JSON.parse(env.USE_CACHE || 'true');
  } catch (_) {
    useCache = true;
  }

  // Create and start the server
  logInfo("Starting File Loader server on port", parseInt(env.FILE_LOADER_PORT || '9000', 10));
  try {
    // Don't await the server.finished promise, which only resolves when the server stops
    createServer({
      requestHandler: createRequestHandler(env, useCache),
      config: {
        port: parseInt(env.FILE_LOADER_PORT || '9000', 10),
        verbose: false
      }
    });
    logInfo("File Loader server started successfully");
  } catch (err) {
    logError("Failed to start File Loader server:", err instanceof Error ? err.message : String(err));
    throw err; // Re-throw to terminate the process
  }

  // Signal successful startup
  logInfo("Preparing to send startup success message");
  // @ts-ignore: self is defined in worker environments
  if (typeof self !== 'undefined' && 'postMessage' in self) {
    logInfo("Sending startup success message to main worker");
    try {
      // @ts-ignore: self is defined in worker environments
      self.postMessage({ message: { 'status': 'ok' } });
      logInfo("Sent startup success message to main worker");
    } catch (err) {
      logError("Failed to send startup message:", err instanceof Error ? err.message : String(err));
    }
  } else {
    logWarning("Cannot send startup message: self or postMessage not available");
  }
})();

/**
 * Creates the main request handler
 * 
 * @param env - Environment variables
 * @param useCache - Whether to use caching
 * @returns A request handler function
 */
function createRequestHandler(env: EnvVars, useCache: boolean) {
  return async (req: Request): Promise<Response> => {
    logInfo("Received request:", req.url);
    
    // Parse authorization header for credentials
    const authorizationEncoded = req.headers.get('authorization')?.slice(6);
    let [username, password] = authorizationEncoded ? atob(authorizationEncoded).split(':') : [];
    
    logDebug("Auth credentials:", username || 'anonymous');

    // Parse provider information from username
    const [provider, org, repo, branch, environment] = username?.split('--') || [];
    if (!provider) {
      username = 'local';
    }
    
    logDebug("Provider info:", { provider: provider || 'local', org, repo, branch });

    // Create URLs for configuration files
    const url = new URL(req.url);
    logDebug("Processing URL:", url.pathname);
    const axionConfigUrl = new URL('/axion.config.json', url);
    const denoConfigUrl = new URL('/deno.json', url);
    const urlWithBasicAuth = new URL(url);

    // Apply authentication if available
    if (username) {
      axionConfigUrl.username = username;
      denoConfigUrl.username = username;
      urlWithBasicAuth.username = username;
    }
    
    if (password) {
      axionConfigUrl.password = password;
      denoConfigUrl.password = password;
      urlWithBasicAuth.password = password;
    }

    // Reset search and set correct paths
    axionConfigUrl.search = '';
    denoConfigUrl.search = '';
    axionConfigUrl.pathname = '/axion.config.json';
    denoConfigUrl.pathname = '/deno.json';

    // Create base file loader config
    const fileLoaderConfig: FileLoaderConfig = {
      dirEntrypoint: env.DIR_ENTRYPOINT || "index",
      debug: env.DEBUG === 'true',
      useCache,
      bustCacheAfter: env.BUST_CACHE_AFTER,
      cachettl: Number(env.CACHE_TTL) || 1000 * 60 * 10,
      loaderType: provider || env.DEFAULT_LOADER_TYPE || 'local',
      owner: org || env.GIT_OWNER,
      repo: repo || env.GIT_REPO,
      branch: branch || env.GIT_BRANCH,
      environment: environment || env.ENV,
      apiKey: password || env.GIT_API_KEY,
    };

    // Create modules for file loader
    const fileLoaderModules: FileLoaderModules = {
      path: {
        SEPARATOR, basename, extname, join, dirname
      },
      withCache: await Cache(username, 'data/local')
    };

    // Check for cached configurations
    let axionConfig = axionConfigs.get(axionConfigUrl.href);
    let denoConfig = denoConfigs.get(denoConfigUrl.href);

    // Create a file loader instance
    const enhancedFileLoader = FileLoader({
      config: fileLoaderConfig,
      modules: fileLoaderModules
    });

    // Create a mock response object for config loading
    const responseMock = {
      status: () => {},
      statusText: () => {},
      headers: () => {},
      redirect: (url: string) => {
        logDebug(`Mock redirect to ${url}`);
        return { redirectUrl: url };
      }
    };

    // Load Axion configuration if not cached
    if (!axionConfig) {
      logDebug('axion.config.json not found in cache for', axionConfigUrl.origin, 'fetching from server...');
      
      try {
        const axionConfigText = await enhancedFileLoader({
          queryParams: {},
          headers: { 'content-type': 'text/plain; charset=utf-8' },
          pathname: axionConfigUrl.pathname,
          url: axionConfigUrl,
        }, responseMock);
        
        const parsedConfig = JSON.parse(axionConfigText || '{}') as AxionConfig;
        axionConfig = parsedConfig;
        axionConfigs.set(axionConfigUrl.href, parsedConfig);
      } catch (err) {
        logError('Error loading axion.config.json:', err instanceof Error ? err.message : String(err));
        axionConfig = {}; // Initialize with empty object to avoid undefined
      }
    }

    // Load Deno configuration if not cached
    if (!denoConfig) {
      logDebug('deno.json not found in cache for', denoConfigUrl.origin, 'fetching from server...');
      
      try {
        // Load deno.json
        const denoConfigText = await enhancedFileLoader({
          queryParams: {},
          headers: { 'content-type': 'text/plain; charset=utf-8' },
          pathname: '/deno.json',
          url: denoConfigUrl,
        }, responseMock);
        
        // Initialize with default values
        denoConfig = {
          imports: { ...axionDenoConfig.imports },
          scopes: {}
        };
        
        // Parse the config if available
        if (denoConfigText) {
          const parsedConfig = JSON.parse(denoConfigText);
          denoConfig.imports = { ...denoConfig.imports, ...(parsedConfig.imports || {}) };
          if (parsedConfig.scopes) {
            denoConfig.scopes = { ...denoConfig.scopes, ...parsedConfig.scopes };
          }
        }
        
        // Load package.json for Node.js dependencies
        const nodeConfigText = await enhancedFileLoader({
          queryParams: {},
          headers: { 'content-type': 'text/plain; charset=utf-8' },
          pathname: '/package.json',
          url: new URL('/package.json', denoConfigUrl),
        }, responseMock);
        
        // Parse and process Node.js dependencies
        if (nodeConfigText) {
          const nodeConfigJson = JSON.parse(nodeConfigText);
          
          // Convert Node.js dependencies to Deno imports
          if (nodeConfigJson.dependencies) {
            Object.entries(nodeConfigJson.dependencies).forEach(([key, value]) => {
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
        }
        
        // Handle potential type mismatch between configs
        const axionScopes = (axionDenoConfig as any).scopes;
        if (axionScopes) {
          denoConfig.scopes = { ...(denoConfig.scopes || {}), ...axionScopes };
        }
        
        // Cache the config
        denoConfigs.set(denoConfigUrl.href, denoConfig);
      } catch (err) {
        logError('Error loading deno configuration:', err instanceof Error ? err.message : String(err));
        denoConfig = { imports: { ...axionDenoConfig.imports }, scopes: {} };
      }
    }

    // Create the final file loader with merged configurations
    const finalFileLoader = FileLoader({
      config: { 
        ...fileLoaderConfig, 
        ...axionConfig 
      },
      modules: fileLoaderModules
    });

    // Extract query parameters from URL
    const queryParams: Record<string, string> = {};
    for (const [key, value] of new URL(req.url).searchParams.entries()) {
      queryParams[key] = value;
    }

    // Extract headers from request
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Process the request with the enhanced file loader
    try {
      logInfo("Calling file loader with pathname:", urlWithBasicAuth.pathname);
      const result = await finalFileLoader({
        queryParams,
        headers,
        pathname: urlWithBasicAuth.pathname,
        url: urlWithBasicAuth,
        data: {
          denoConfig: {
            ...denoConfig,
          }
        }
      }, {
        status: (status: number) => {
          logDebug("Setting status:", status);
          return new Response('', { status });
        },
        statusText: (text: string) => {
          logDebug("Setting status text:", text);
          return new Response('', { statusText: text });
        },
        headers: (headers: Record<string, string>) => {
          logDebug("Setting headers:", JSON.stringify(headers));
          return new Response('', { headers });
        },
        redirect: (url: string) => {
          logInfo("Redirecting to:", url);
          return new Response('', { 
            status: 302, 
            headers: { 'Location': url } 
          });
        }
      });

      // Check if result is already a Response (from redirect)
      if (result instanceof Response) {
        logInfo("Returning redirect response");
        return result;
      }

      // Determine content type based on result
      let contentType = 'text/plain; charset=utf-8';
      let status = 200;
      let statusText = 'OK';
      let responseHeaders = {};
      
      // Set content type from headers if available
      if (typeof result === 'object' && !('__redirect__' in result)) {
        contentType = 'application/json; charset=utf-8';
        logDebug("Returning JSON response");
        return new Response(JSON.stringify(result), {
          status,
          statusText,
          headers: { 'content-type': contentType }
        });
      }

      logDebug("Returning text response");
      return new Response(result, {
        status,
        statusText,
        headers: { 'content-type': contentType }
      });
    } catch (err) {
      logError('Error processing file request:', err instanceof Error ? err.message : String(err));
      return new Response(JSON.stringify({
        error: err instanceof Error ? err.message : String(err)
      }), {
        status: 500,
        headers: { 'content-type': 'application/json; charset=utf-8' }
      });
    }
  };
}
