/**
 * Logger utility for Axion Functions
 * 
 * Provides consistent logging functionality with configurable log levels
 */

/**
 * Global configuration for logging levels
 */
export interface LogConfig {
  debugLogs?: boolean;
  errorLogs?: boolean;
  infoLogs?: boolean;
  warningLogs?: boolean;
}

// Default global config
let globalConfig: LogConfig = { 
  debugLogs: true, 
  errorLogs: true, 
  infoLogs: true, 
  warningLogs: true 
};

/**
 * Set global logging configuration
 * 
 * @param config - Configuration object with log level settings
 */
export function setLogConfig(config: LogConfig): void {
  globalConfig = { ...globalConfig, ...config };
}

/**
 * Get current logging configuration
 * 
 * @returns Current log configuration
 */
export function getLogConfig(): LogConfig {
  return { ...globalConfig };
}

/**
 * Log debug message if debug logging is enabled
 * 
 * @param message - Message to log
 * @param args - Additional arguments to log
 */
export function logDebug(message: string, ...args: any[]): void {
  if (globalConfig?.debugLogs) {
    console.log(`[DEBUG] ${message}`, ...args);
  }
}

/**
 * Log debug message if debug logging is enabled in the provided config
 * 
 * @param config - Configuration with debugLogs setting
 * @param message - Message to log
 * @param args - Additional arguments to log
 */
export function logDebugWithConfig(config: { debugLogs?: boolean }, message: string, ...args: any[]): void {
  if (config?.debugLogs) {
    console.log(`[DEBUG] ${message}`, ...args);
  }
}

/**
 * Log error message if error logging is enabled
 * 
 * @param message - Message to log
 * @param args - Additional arguments to log
 */
export function logError(message: string, ...args: any[]): void {
  if (globalConfig?.errorLogs) {
    console.error(`[ERROR] ${message}`, ...args);
  }
}

/**
 * Log info message if info logging is enabled
 * 
 * @param message - Message to log
 * @param args - Additional arguments to log
 */
export function logInfo(message: string, ...args: any[]): void {
  if (globalConfig?.infoLogs) {
    console.log(`[INFO] ${message}`, ...args);
  }
}

/**
 * Log warning message if warning logging is enabled
 * 
 * @param message - Message to log
 * @param args - Additional arguments to log
 */
export function logWarning(message: string, ...args: any[]): void {
  if (globalConfig?.warningLogs) {
    console.warn(`[WARNING] ${message}`, ...args);
  }
} 