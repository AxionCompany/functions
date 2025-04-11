/**
 * Axion File Loader Core
 * 
 * This module provides functionality for loading files from various sources,
 * handling redirects, bundling, and setting appropriate content types.
 * 
 * The file loader supports multiple loader types (local, github, etc.) and
 * can be configured to use caching, bundling, and other features.
 */

import FileLoader from "./adapters/loaders/main.ts";
import bundler, { terminateWorker } from './adapters/bundler/esbuild.js';
import mime from 'npm:mime/lite';
import { logDebug, logError, logInfo, logWarning } from "../utils/logger.ts";

// Constants for configuration
const ONE_DAY_IN_MS = 1000 * 60 * 60 * 24;
const DEFAULT_CONTENT_TYPE = 'text/plain; charset=utf-8';
const JS_TS_CONTENT_TYPE = 'text/tsx; charset=utf-8';
const JS_TS_EXTENSIONS = ['js', 'jsx', 'ts', 'tsx'];

/**
 * File loader configuration
 */
export interface FileLoaderConfig {
  /** Type of loader to use (local, github, etc.) */
  loaderType: string;
  /** Whether to enable debug logging */
  debug?: boolean;
  /** Whether to enable verbose logging */
  verbose?: boolean;
  /** Whether to use caching */
  useCache?: boolean;
  /** Whether to bust the cache */
  bustCache?: boolean;
  /** Environment for the loader */
  environment?: string;
  /** Entrypoint for the loader */
  dirEntrypoint?: string;
  /** Any additional properties */
  [key: string]: any;
}

/**
 * File loader modules
 */
export interface FileLoaderModules {
  /** Cache module */
  withCache?: (fn: Function, options: any, ...args: any[]) => Promise<any>;
  /** Any additional modules */
  [key: string]: any;
}

/**
 * File loader request parameters
 */
export interface FileLoaderRequest {
  /** Path to load */
  pathname: string;
  /** URL of the request */
  url: URL;
  /** Request headers */
  headers: Record<string, string>;
  /** Query parameters */
  queryParams: Record<string, string>;
  /** Additional data */
  data?: Record<string, any>;
  /** Request ID for tracking */
  __requestId__?: string;
  /** Any additional properties */
  [key: string]: any;
}

/**
 * File loader response interface
 */
export interface FileLoaderResponse {
  /** Set response status */
  status: (status: number) => any;
  /** Set response status text */
  statusText: (text: string) => any;
  /** Set response headers */
  headers: (headers: Record<string, string>) => any;
  /** Redirect to URL */
  redirect: (url: string) => any;
  /** Any additional properties */
  [key: string]: any;
}

/**
 * File data returned from the loader
 */
export interface FileData {
  /** File content */
  content?: string;
  /** Whether to redirect */
  redirect?: boolean;
  /** URL parameters */
  params?: Record<string, string>;
  /** File path */
  path?: string;
  /** Environment variables */
  variables?: Record<string, any>;
  /** Matched path */
  matchPath?: string;
  /** Any additional properties */
  [key: string]: any;
}

/**
 * Bundle options for file bundling
 */
interface BundleOptions {
  /** URL for bundling */
  bundleUrl: URL;
  /** Whether to use cache */
  useCache: boolean;
  /** Whether to bust cache */
  bustCache?: boolean;
  /** Shared modules */
  shared?: string[];
  /** Environment variables */
  variables?: Record<string, any>;
  /** Additional data */
  data?: Record<string, any>;
  /** URL parameters */
  params?: Record<string, string>;
  /** Environment */
  environment?: string;
}

/**
 * Creates a file loader with the given configuration and modules
 * 
 * @param options - Configuration and modules for the file loader
 * @returns A function that loads files based on the request
 */
export default function createFileLoader({
  config,
  modules
}: {
  config: FileLoaderConfig;
  modules: FileLoaderModules;
}) {
  logInfo("Creating file loader with config:", {
    loaderType: config.loaderType,
    debug: config.debug,
    useCache: config.useCache
  });

  // Create the base file loader
  const fileLoader = FileLoader({ config, modules });

  /**
   * Loads a file based on the request
   * 
   * @param request - File loader request
   * @param response - File loader response
   * @returns File content or metadata
   */
  const loader = async (request: FileLoaderRequest, response: FileLoaderResponse) => {
    logDebug("Processing request for:", request.pathname);

    // Extract request parameters
    const { pathname, url, headers, queryParams, data } = request;
    const { bundle: shouldBundle, shared, ...searchParams } = queryParams;

    // Update cache busting configuration
    const bustCache = data?.bustCache;
    config.bustCache = bustCache;

    // Determine if this is an import request (not JSON)
    const contentTypeHeaders = headers["content-type"];
    const isImport = !(contentTypeHeaders && contentTypeHeaders?.includes("application/json"));
    logDebug("Request type:", isImport ? "Import" : "JSON");

    // Load the file
    const fileData = await loadFile(fileLoader, pathname);

    if (!fileData || !fileData.content) {
      return handleNotFound(response, pathname);
    }

    // Extract file data
    const { content, redirect: shouldRedirect, params, path, variables, matchPath } = fileData;

    // Handle bundling if requested
    if (shouldBundle) {
      const bundledContent = await handleBundling({
        bundleUrl: new URL(url.href),
        useCache: config.useCache || false,
        bustCache,
        shared: shared?.split(','),
        variables,
        data,
        params,
        environment: config.environment
      }, modules, matchPath || pathname);

      if (bundledContent) {
        return {
          content: bundledContent,
          params,
          path,
          matchPath
        };
      }
    }

    // Handle redirects if needed and not bundling
    const shouldPerformRedirect = shouldRedirect && !shouldBundle;
    if (shouldPerformRedirect && path) {
      return handleRedirect(response, url, path, searchParams);
    }

    // Return metadata for non-import requests
    if (!isImport) {
      return handleJsonResponse(fileData);
    }

    // Set content type and return content
    setContentType(response, matchPath);
    return content;
  };

  // Add a cleanup method to the loader function
  (loader as any).cleanup = () => {
    logInfo("Cleaning up file loader resources");
    terminateWorker();
  };

  return loader;
}

/**
 * Loads a file using the provided file loader
 * 
 * @param fileLoader - The file loader function
 * @param pathname - Path to the file
 * @returns File data or undefined if loading fails
 */
async function loadFile(
  fileLoader: Function,
  pathname: string
): Promise<FileData | undefined> {
  const startTime = Date.now();
  let fileData: FileData | undefined;

  try {
    logDebug("Loading file:", pathname);
    fileData = await fileLoader({
      path: pathname,
      currentPath: ".",
      params: {},
      fullPath: undefined
    });

    const loadTime = Date.now() - startTime;
    logInfo("File loaded successfully in", loadTime, "ms");
    logDebug("File data:", {
      hasContent: !!fileData?.content,
      redirect: fileData?.redirect,
      path: fileData?.path,
      matchPath: fileData?.matchPath
    });

    return fileData;
  } catch (err) {
    logError("Error loading file:", err instanceof Error ? err.message : String(err));
    return undefined;
  }
}

/**
 * Handles 404 Not Found responses
 * 
 * @param response - Response object
 * @param pathname - Path that was not found
 * @returns undefined to terminate the request
 */
function handleNotFound(response: FileLoaderResponse, pathname: string): undefined {
  logWarning("No content found, returning 404 for:", pathname);
  response.status(404);
  response.statusText(`No path found for ${pathname}`);
  return undefined;
}

/**
 * Handles bundling of file content
 * 
 * @param options - Bundle options
 * @param modules - Available modules
 * @param pathForBundle - Path to use for bundling
 * @returns Bundled content or undefined if bundling fails
 */
async function handleBundling(
  options: BundleOptions,
  modules: FileLoaderModules,
  pathForBundle: string
): Promise<string | undefined> {
  logDebug("Bundling requested for:", pathForBundle);

  if (!modules.withCache) {
    logError('Bundling requested but withCache module is not available');
    return undefined;
  }

  try {
    // Configure bundle URL
    const bundleUrl = options.bundleUrl;
    bundleUrl.pathname = pathForBundle;
    bundleUrl.search = '';

    // Bundle the content
    const bundleContent = await modules.withCache(
      bundler,
      {
        useCache: options.useCache,
        bustCache: options.bustCache,
        keys: [bundleUrl.href],
        cachettl: ONE_DAY_IN_MS
      },
      bundleUrl,
      {
        shared: options.shared,
        ...options.variables,
        ...options.data,
        ...options.params,
        environment: options.environment
      }
    );

    if (bundleContent) {
      logInfo("Bundling successful");
      return bundleContent;
    }

    logWarning("Bundling returned no content");
    return undefined;
  } catch (err) {
    logError("Error bundling file:", err instanceof Error ? err.message : String(err));
    return undefined;
  }
}

/**
 * Handles redirects to other paths
 * 
 * @param response - Response object
 * @param originalUrl - Original request URL
 * @param redirectPath - Path to redirect to
 * @param searchParams - Search parameters to include
 * @returns Result of the redirect operation
 */
function handleRedirect(
  response: FileLoaderResponse,
  originalUrl: URL,
  redirectPath: string,
  searchParams: Record<string, string>
): any {
  logInfo("Redirecting to:", redirectPath);

  // Create redirect URL with the correct path and search parameters
  const redirectUrl = new URL(originalUrl.href);
  redirectUrl.search = new URLSearchParams(searchParams).toString();
  redirectUrl.pathname = redirectPath;

  logDebug(`Redirect URL: ${redirectUrl.href}`);

  // Return redirect response
  return response.redirect(redirectUrl.href);
}

/**
 * Handles JSON response for non-import requests
 * 
 * @param fileData - File data to return
 * @returns File data object
 */
function handleJsonResponse(fileData: FileData): FileData {
  const { content, redirect, params, path, variables, matchPath } = fileData;

  logDebug("Returning JSON metadata");
  return {
    content,
    redirect,
    params,
    path,
    variables,
    matchPath
  };
}

/**
 * Sets the appropriate content type based on the file path
 * 
 * @param response - Response object
 * @param matchPath - Path to determine content type from
 */
function setContentType(response: FileLoaderResponse, matchPath?: string): void {
  if (!matchPath) {
    logDebug("No match path, using default content type");
    response.headers({ 'content-type': DEFAULT_CONTENT_TYPE });
    return;
  }

  const fileExtension = matchPath.split('.').pop() || '';

  if (JS_TS_EXTENSIONS.includes(fileExtension)) {
    logDebug("Setting JS/TS content type for extension:", fileExtension);
    response.headers({ 'content-type': JS_TS_CONTENT_TYPE });
    return;
  }

  // Set mime type for other files
  setMimeType(response, matchPath);
}

/**
 * Sets the appropriate MIME type for a file based on its path
 * 
 * @param response - Response object to set headers on
 * @param pathname - Path of the file
 */
function setMimeType(response: FileLoaderResponse, pathname: string): void {
  logDebug("Setting mime type for file:", pathname);
  try {
    const mimeType = mime.getType(pathname) || DEFAULT_CONTENT_TYPE;
    logDebug("Detected mime type:", mimeType);
    response.headers({ 'content-type': mimeType });
  } catch (err) {
    logError("Error setting mime type:", err instanceof Error ? err.message : String(err));
    response.headers({ 'content-type': DEFAULT_CONTENT_TYPE });
  }
}
