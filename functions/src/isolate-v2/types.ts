
/**
 * Represents the data parsed from an incoming HTTP request.
 */
export interface RequestData {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: any; // Could be parsed JSON, raw text, FormData, etc.
  queryParams: Record<string, string>;
  params?: Record<string, string>;
  [key: string]: any;
}

/**
 * Database configuration for isolate-v2
 */
export interface DatabaseConfig {
  enabled: boolean;
  remoteURL?: string;
  lwwColumn?: string;
  edgeId?: string;
  url?: string;
  schemaSQL?: string[];
  schema?: Record<string, any>;
}

/**
 * File loader configuration for isolate-v2
 */
export interface FileLoaderConfig {
  loaderType: string;
  debug?: boolean;
  verbose?: boolean;
  useCache?: boolean;
  bustCache?: boolean;
  environment?: string;
  dirEntrypoint?: string;
  [key: string]: any;
}

/**
 * Comprehensive configuration for isolate-v2
 * Extends the base OxianConfig with isolate-specific properties
 */
export interface IsolateConfig {
  // Core isolate properties
  projectId: string;
  projectPath: string;
  isolateId?: string;
  
  // Root of functions for in-process loader
  functionsDir?: string;
  
  // Environment and request context
  env: Record<string, string>;
  url?: string;
  headers?: Headers;
  
  // Import URL configuration (from environment or proxy headers)
  importUrl?: string;
  loaderUrl?: string;
  
  // Database configuration
  database?: DatabaseConfig;
  
  // File loader configuration
  fileLoader?: FileLoaderConfig;
  
  // Caching and performance
  bustCache?: boolean;
  
  // Loader configuration
  loaderConfig?: {
    username?: string;
    password?: string;
    [key: string]: any;
  };
  
  // Logging configuration
  debugLogs?: boolean;
  errorLogs?: boolean;
  infoLogs?: boolean;
  warningLogs?: boolean;
  
  // Schema configuration
  schemaSQL?: string[];
  schema?: Record<string, any>;
  
  // Deno configuration for bundling
  denoConfig?: {
    imports?: Record<string, string>;
    scopes?: Record<string, Record<string, string>>;
    [key: string]: any;
  };
  
  // Any additional properties from base OxianConfig
  [key: string]: any;
}

/**
 * The standard function signature for all handlers (endpoints, middlewares, etc.).
 * It receives parsed request data as the first argument and the context as the second.
 *
 * @template D The type for application-specific dependencies.
 * @template E The type for environment variables.
 */
export type Handler<
  D = Record<string, any>,
  E = Record<string, string | undefined>
> = (
  data: Record<string, any>,
  context: OxianContext<D, E>
) => Promise<any> | any;

export type FactoryHandler<
  D = Record<string, any>,
  E = Record<string, string | undefined>
> = (
  context: OxianContext<D, E>
) => Promise<Handler<D, E>> | any;


/**
 * Provides methods for constructing an HTTP response.
 * These methods configure the response, which is ultimately sent by the server.
 */
export interface ResponseHandler {
  send: (data: any) => void;
  error: (error: any) => void;
  status: (code: number) => ResponseHandler;
  statusText: (text: string) => ResponseHandler;
  headers: (headers: Record<string, string>) => ResponseHandler;
  stream: (chunk: string) => void;
}

/**
 * The unified context object passed to all user-defined functions,
 * including endpoints, middlewares, and interceptors.
 *
 * @template D The type for application-specific dependencies.
 * @template E The type for environment variables.
 */
export interface OxianContext<
  D = Record<string, any>,
  E = Record<string, string | undefined>
> {
  requestId: string;
  executionId?: string;
  timestamp?: number;
  name?: string;
  request: RequestData;
  response: ResponseHandler;
  dependencies: D;
  env: E;

  // A simple state store for passing data between middlewares for a single request.
  _state: Map<string, any>;
  get: <T>(key: string) => T | undefined;
  set: <T>(key: string, value: T) => void;
} 