/**
 * Request Handler Module
 * 
 * This module provides a handler for processing HTTP requests in isolates.
 * It handles request parsing, route matching, response streaming, and error handling.
 */

import responseCallback from "./utils/responseCallback.ts";
import { getSubdomain } from "./utils/urlFunctions.ts";

/**
 * Interface for data chunks in the stream
 */
interface DataChunk {
  /** Response options including headers and status */
  options?: {
    headers?: Record<string, string>;
    status?: number;
    statusText?: string;
  };
  /** Content chunk */
  chunk: string;
  /** Request ID for tracking */
  __requestId__?: string;
  /** Flag indicating if this is the final chunk */
  __done__?: boolean;
  /** Flag indicating if an error occurred */
  __error__?: boolean;
}

/**
 * Interface for handler configuration
 */
interface HandlerConfig {
  /** Route handlers mapped by path pattern */
  handlers: Record<string, RouteHandler>;
  /** Middleware functions */
  middlewares?: Record<string, MiddlewareFunction>;
}

/**
 * Type definition for route handler functions
 */
type RouteHandler = (requestData: RequestData, response: ResponseFunction) => Promise<any>;

/**
 * Type definition for middleware functions
 */
type MiddlewareFunction = (requestData: RequestData, next: () => Promise<any>) => Promise<any>;

/**
 * Interface for request data passed to handlers
 */
interface RequestData {
  /** Request URL */
  url: URL;
  /** Subdomain from the URL */
  subdomain: string | null;
  /** Request path */
  pathname: string;
  /** Path parameters extracted from the URL */
  pathParams: Record<string, any>;
  /** HTTP method */
  method: string;
  /** Query parameters */
  queryParams: Record<string, string>;
  /** Parsed request body */
  data: any;
  /** Raw request body */
  body: string;
  /** Form data from multipart requests */
  formData: Record<string, any>;
  /** Request headers */
  headers: Record<string, string>;
  /** Request ID for tracking */
  __requestId__: string;
}

/**
 * Interface for response functions
 */
interface ResponseFunction {
  /** Send a response */
  send: (data: any) => void;
  /** Send an error response */
  error: (error: any) => void;
  /** Set response status code */
  status: (code: number) => ResponseFunction;
  /** Set response status text */
  statusText: (text: string) => ResponseFunction;
  /** Set response headers */
  headers: (headers: Record<string, string>) => ResponseFunction;
  /** Stream a response chunk */
  stream: (chunk: string) => void;
}

/**
 * Creates a stream buffer for handling streaming responses
 * 
 * @param highWaterMark - Buffer high water mark
 * @param options - Stream options including data processing and options sending functions
 * @returns Stream buffer controller
 */
function createStreamBuffer(
  highWaterMark: number = 1, 
  { processData, sendOptions }: { 
    processData: (data: DataChunk) => DataChunk; 
    sendOptions: (options: Record<string, any>) => void;
  }
) {
  // Stream state
  let buffer: Uint8Array[] = [];
  let controller: ReadableStreamDefaultController<Uint8Array>;
  let headersSent = false;
  let shouldClose = false;

  // Create readable stream
  const readableStream = new ReadableStream<Uint8Array>({
    start(ctrl) {
      controller = ctrl;
    },
    pull() {
      flushBuffer();
    },
    cancel() {
      buffer = [];
      headersSent = false;
      shouldClose = false;
    }
  }, {
    highWaterMark
  });

  /**
   * Adds a data chunk to the stream
   * 
   * @param data - Data chunk to add
   */
  function enqueue(data: DataChunk) {
    // Process the data
    data = processData(data);

    // Encode the chunk and add to buffer or stream
    const encodedChunk = new TextEncoder().encode(data.chunk);
    if (controller.desiredSize! > 0) {
      controller.enqueue(encodedChunk);
    } else {
      buffer.push(encodedChunk);
    }

    // Handle stream completion
    if (data.__done__ || data.__error__) {
      shouldClose = true;
      flushBuffer();
    }

    // Send headers if not already sent
    if (!headersSent && data.options) {
      headersSent = true;
      sendOptions(data.options);
    }
  }

  /**
   * Flushes the buffer to the stream
   */
  function flushBuffer() {
    while (buffer.length > 0 && controller.desiredSize! > 0) {
      const chunk = buffer.shift();
      controller.enqueue(chunk!);
    }
    
    if (shouldClose && buffer.length === 0) {
      controller.close();
    }
  }

  /**
   * Gets the readable stream
   * 
   * @returns The readable stream
   */
  function getStream(): ReadableStream<Uint8Array> {
    return readableStream;
  }

  return { enqueue, getStream };
}

/**
 * Creates a request handler function
 * 
 * @param config - Handler configuration
 * @returns Request handler function
 */
export default function createRequestHandler(config: HandlerConfig) {
  const { handlers } = config;

  /**
   * Processes a request and returns a response
   * 
   * @param req - The request to process
   * @returns Response object
   */
  return async (req: Request): Promise<Response> => {
    try {
      // Generate a unique request ID
      const requestId = crypto.randomUUID();
      
      // Parse request headers
      const headers = Object.fromEntries(req.headers.entries());
      const contentType = headers?.["content-type"] || headers?.["Content-Type"] || "";
      
      // Parse form data for multipart requests
      const formData: Record<string, any> = {};
      if (contentType.includes("multipart/form-data")) {
        try {
          const form = await req.formData();
          for (const [key, value] of form.entries()) {
            if (value instanceof File) {
              // Transform file to base64
              const base64data = await fileToBase64(value);
              
              if (!formData[key]) {
                formData[key] = base64data;
              } else if (Array.isArray(formData[key])) {
                formData[key].push(base64data);
              } else {
                formData[key] = [formData[key], base64data];
              }
            } else {
              // Try to parse JSON values
              try {
                formData[key] = JSON.parse(value.toString());
              } catch {
                formData[key] = value;
              }
            }
          }
        } catch (error) {
          console.error("Error parsing form data:", error);
        }
      }

      // Parse request body
      let body = "";
      let data = null;
      try {
        body = await req.text();
        try {
          data = JSON.parse(body);
        } catch {
          data = { data: body };
        }
      } catch (error) {
        console.error("Error parsing request body:", error);
      }

      // Parse URL and query parameters
      const url = new URL(req.url);
      const subdomain = getSubdomain(req.url);
      const queryParams = Object.fromEntries(url.searchParams.entries());
      const method = req.method;
      
      // Get path name and find matching handler
      let pathname = url.pathname;
      let matchedHandler: RouteHandler | undefined;
      let pathParams: Record<string, string> = {};

      // Match route handler
      for (const routePattern in handlers) {
        const routeHandler = new URLPattern({ pathname: routePattern });
        const match = routeHandler.exec(url);
        
        if (match?.pathname?.groups) {
          const pathGroups = match.pathname.groups;
          const pathPart = pathGroups["0"] ? pathGroups["0"] : '';
          pathname = ("/" + pathPart).replace(/\/{2,}/g, "/");
          matchedHandler = handlers[routePattern];
          pathParams = pathGroups as Record<string, string>;
          break;
        }
      }

      // If no handler found, return 404
      if (!matchedHandler) {
        return new Response(
          JSON.stringify({ error: { message: "Not Found", status: 404 } }),
          {
            status: 404,
            headers: {
              "content-type": "application/json; charset=utf-8"
            }
          }
        );
      }

      // Set up response options promise
      let sendOptionsFunction: (options: Record<string, any>) => void;
      const responseOptionsPromise = new Promise<Record<string, any>>((resolve) => {
        sendOptionsFunction = (options: Record<string, any>) => resolve({
          status: options?.status || 200,
          statusText: options?.statusText || "OK",
          ...(options || {}),
          headers: {
            "content-type": "text/plain;charset=utf-8",
            "x-content-type-options": "nosniff",
            ...(options?.headers || {}),
          },
        });
      });

      // Create data processor for the stream
      const processData = ({ chunk, options, __requestId__, __done__, __error__ }: DataChunk): DataChunk => {
        options = options || {};

        // Convert objects to JSON
        if (chunk && typeof chunk === "object") {
          chunk = JSON.stringify(chunk);
          options.headers = {
            ...options?.headers,
            "content-type": "application/json; charset=utf-8",
          };
        }

        return { chunk, options, __requestId__, __done__, __error__ };
      };

      // Create stream buffer
      const { getStream, enqueue } = createStreamBuffer(1, { 
        processData, 
        sendOptions: sendOptionsFunction! 
      });

      // Create response callback
      const responseFunction = responseCallback(requestId, enqueue) as unknown as ResponseFunction;

      // Create request data object
      const requestData: RequestData = {
        url,
        subdomain,
        pathname,
        pathParams,
        method,
        queryParams,
        data,
        body,
        formData,
        headers,
        __requestId__: requestId
      };

      // Execute handler and handle response
      matchedHandler(requestData, responseFunction)
        .then(responseFunction.send)
        .catch(responseFunction.error);

      // Wait for response options
      const options = await responseOptionsPromise;
      
      // Return streaming response
      return new Response(getStream(), options);
    } catch (error) {
      // Handle unexpected errors
      // const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
      const errorStatus = error instanceof Error && 'status' in error ? Number((error as any).status) : 500;
      const errorStatusText = error instanceof Error ? error.message : "Internal Server Error";
      
      // Create error response
      const options = {
        status: errorStatus,
        statusText: errorStatusText,
        headers: {
          "content-type": "application/json; charset=utf-8"
        }
      };

      // Format error object
      let errorObject: Record<string, any>;
      if (typeof error === "string") {
        errorObject = { message: error };
      } else if (error instanceof Error) {
        errorObject = {
          message: error.message,
          status: errorStatus,
          stack: error.stack
        };
      } else {
        errorObject = { message: "Unknown error" };
      }

      return new Response(
        JSON.stringify({ error: errorObject }),
        options
      );
    }
  };
}

/**
 * Converts a File object to base64 string
 * 
 * @param file - File to convert
 * @returns Promise resolving to base64 string
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.readAsDataURL(file);
  });
}



