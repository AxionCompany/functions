/**
 * HTTP Server module
 * 
 * This module provides a configurable HTTP server with CORS support
 * and custom request handling.
 */

/**
 * Server configuration interface
 */
export interface ServerConfig {
  /** Port to listen on */
  port?: number;
  /** Additional configuration options */
  [key: string]: any;
}

/**
 * Request handler function type
 */
export type RequestHandler = (request: Request) => Promise<Response>;

/**
 * Server initialization options
 */
export interface ServerOptions {
  /** Request handler function */
  requestHandler: RequestHandler;
  /** Server configuration */
  config?: ServerConfig;
  /** Port to listen on (alternative to config.port) */
  port?: number;
}

/**
 * Default CORS headers
 */
const DEFAULT_CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "GET, POST, PUT, DELETE",
};

/**
 * Creates and starts an HTTP server
 * 
 * @param options - Server options including request handler and configuration
 * @returns A promise that resolves when the server is stopped
 */

const DEFAULT_PORT = 9000;
const DEFAULT_HOST = '0.0.0.0';
export default function createServer(options: ServerOptions): Promise<void> {
  const { requestHandler, config = {}, port } = options;
  
  // Determine the port to use
  const serverPort = port || config?.port || DEFAULT_PORT;
  
  // Create and start the server
  const server = Deno.serve(
    { port: serverPort, hostname: DEFAULT_HOST },
    async (request: Request): Promise<Response> => {
      // Handle OPTIONS requests for CORS preflight
      if (request.method === "OPTIONS") {
        return new Response("OK", {
          headers: DEFAULT_CORS_HEADERS,
          status: 200,
          statusText: "OK",
        });
      }

      try {
        // Process the request with the provided handler
        const response = await requestHandler(request);
        
        // Add CORS headers to the response
        const responseHeaders = new Headers(response.headers);
        Object.entries(DEFAULT_CORS_HEADERS).forEach(([key, value]) => {
          responseHeaders.set(key, value);
        });

        // Return the response with CORS headers
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders
        });
      } catch (error) {
        // Handle any errors that occur during request processing
        console.error("Error handling request:", error);
        
        // Return a 500 error response
        return new Response(
          JSON.stringify({ 
            error: { 
              message: error instanceof Error ? error.message : "Internal Server Error",
              status: 500
            } 
          }),
          {
            status: 500,
            headers: {
              ...DEFAULT_CORS_HEADERS,
              "content-type": "application/json"
            }
          }
        );
      }
    },
  );
  
  // Return the server's finished promise
  return server.finished;
}