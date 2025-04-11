/**
 * API Server Example
 * 
 * This server demonstrates how to use the Axion File Loader as a standalone service
 * to create a powerful file-based API routing system similar to Next.js or Vercel's
 * serverless functions.
 * 
 * This example uses Deno's ability to import modules directly via HTTP URLs,
 * connecting to the existing file-loader.ts server to dynamically load API handlers.
 * 
 * Usage:
 * deno run --allow-net --allow-read --allow-env examples/api-server.ts [options]
 * 
 * Options:
 *   --port=<number>              Port to listen on (default: 8000)
 *   --file-loader-url=<url>      URL of the file loader server (default: http://localhost:3000)
 *   --debug                      Enable debug logging
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { parse } from "https://deno.land/std@0.177.0/flags/mod.ts";
import { logDebug, logError, logInfo, setLogConfig } from "../functions/src/utils/logger.ts";

// Parse command line arguments
const args = parse(Deno.args, {
  string: ["port", "file-loader-url"],
  boolean: ["debug"],
  default: {
    port: "8000",
    "file-loader-url": "http://localhost:9000"
  },
});

// Configure logging
setLogConfig({
  debugLogs: args.debug === true,
  errorLogs: true,
  infoLogs: true,
  warningLogs: true,
});

// Store for imported modules
const moduleCache = new Map<string, { module: any; timestamp: number }>();

/**
 * Fetches a file from the file loader server
 */
async function fetchFile(path: string): Promise<any> {
  const fileLoaderUrl = args["file-loader-url"];
  const url = `${fileLoaderUrl}/${path}`;
  
  logDebug(`Fetching file from ${url}`);
  
  try {
    // Add Accept header to get JSON response
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json"
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      
      throw new Error(`File loader server returned status ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    logError(`Error fetching file from ${url}:`, error);
    throw error;
  }
}

/**
 * Dynamically imports a module from the file loader server
 */
async function importModule(path: string): Promise<any> {
  const cacheKey = path;
  const now = Date.now();
  const cacheTTL = 60000; // 1 minute
  
  // Check if module is in cache and not expired
  if (moduleCache.has(cacheKey)) {
    const cachedModule = moduleCache.get(cacheKey)!;
    if (now - cachedModule.timestamp < cacheTTL) {
      logDebug(`Using cached module for ${path}`);
      return cachedModule.module;
    }
  }
  
  // Fetch the file metadata from the file loader server
  const fileData = await fetchFile(path);
  
  if (!fileData || !fileData.content) {
    return null;
  }
  
  try {
    // Create a URL for the module
    const fileLoaderUrl = args["file-loader-url"];
    const moduleUrl = `${fileLoaderUrl}/${path}`;
    console.log(moduleUrl);
    
    // Import the module directly via HTTP
    const module = await import(moduleUrl);

    console.log('module', module);
    
    // Cache the module
    moduleCache.set(cacheKey, {
      module,
      timestamp: now
    });
    
    return module;
  } catch (error) {
    logError(`Error importing module from ${path}:`, error);
    throw error;
  }
}

/**
 * Processes an API request
 */
async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;
  
  logInfo(`${req.method} ${pathname}`);
  
  try {
    // Get the API path
    const apiPath = pathname.startsWith("/") ? pathname.slice(1) : pathname;
    
    // Fetch the file metadata from the file loader server
    const fileData = await fetchFile(apiPath);
    
    if (!fileData) {
      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
    
    // Extract parameters from the file data
    const params = fileData.params || {};
    const variables = fileData.variables || {};
    
    // Create a context object for the API handler
    const context = {
      params,
      query: Object.fromEntries(url.searchParams.entries()),
      env: variables,
      request: req,
    };
    
    try {
      // Import the module directly from the file loader server
      const module = await importModule(apiPath);
      
      if (!module) {
        return new Response(JSON.stringify({ error: "Failed to load module" }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
          },
        });
      }
      
      // Get the appropriate handler based on the HTTP method
      const method = req.method.toLowerCase();
      const handler = module[method] || module.default;
      
      if (typeof handler !== "function") {
        return new Response(JSON.stringify({ error: `Method ${req.method} not allowed` }), {
          status: 405,
          headers: {
            "Content-Type": "application/json",
          },
        });
      }
      
      // Execute the handler with the context
      const result = await handler(context);
      
      // If the handler returns a Response, use it directly
      if (result instanceof Response) {
        return result;
      }
      
      // Otherwise, convert the result to JSON
      return new Response(JSON.stringify(result), {
        headers: {
          "Content-Type": "application/json",
        },
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logError("Error executing API handler:", errorMessage);
      return new Response(JSON.stringify({ error: "Internal Server Error", message: errorMessage }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError("Request handling error:", errorMessage);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}

// Start the HTTP server
const port = parseInt(args.port);
logInfo(`Starting API Server on port ${port}...`);
logInfo(`Using File Loader Server at: ${args["file-loader-url"]}`);

serve(handleRequest, { port }); 