/**
 * Base adapter configuration interfaces and utilities
 */

/**
 * Base adapter configuration interface
 */
export interface AdapterConfig {
  /** Request URL */
  url: string;
  /** Request headers */
  headers: Headers;
  /** Environment variables */
  env: Record<string, string>;
  /** Loader configuration */
  loaderConfig?: {
    username?: string;
    password?: string;
    [key: string]: any;
  };
  /** Any additional properties */
  [key: string]: any;
} 