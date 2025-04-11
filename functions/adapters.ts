/**
 * Adapters configuration module
 * 
 * This module provides configuration for isolate management and load balancing.
 */

import { PermissionsConfig } from "./src/proxy/utils/runOptions.ts";

/**
 * Base adapter configuration interface
 */
export interface AdapterConfig {
  /** Any additional properties */
  [key: string]: any;
}

/**
 * Extended adapter configuration with isolate settings
 */
export interface IsolateAdapterConfig extends AdapterConfig {
  /** Function to map file paths to isolate IDs */
  mapFilePathToIsolateId?: ((params: { formattedFileUrl: string, fileUrl?: string }) => string) | null;
  /** Maximum idle time for isolates in milliseconds */
  isolateMaxIdleTime?: number;
  /** Isolate type (worker or subprocess) */
  isolateType?: 'worker' | 'subprocess';
  /** Permissions configuration */
  permissions?: Partial<PermissionsConfig>;
}

/**
 * Maximum number of isolates to create
 */
const MAX_ISOLATES = 2;

/**
 * Current isolate index for round-robin allocation
 */
let currentIsolateIndex = 0;

/**
 * Creates a round-robin isolate ID mapper function
 * 
 * @returns A function that maps file paths to isolate IDs
 */
function createRoundRobinMapper(): (params: { formattedFileUrl: string }) => string {
  return ({ formattedFileUrl }) => {
    // Increment the isolate index and wrap around
    currentIsolateIndex = (currentIsolateIndex + 1) % MAX_ISOLATES;
    return String(currentIsolateIndex);
  };
}

/**
 * Configures adapters with isolate settings
 * 
 * @param baseAdapters - Base adapter configuration
 * @returns Enhanced adapter configuration with isolate settings
 */
export default function configureAdapters(baseAdapters: AdapterConfig): IsolateAdapterConfig {
  // Uncomment to enable round-robin load balancing
  // const mapFilePathToIsolateId = createRoundRobinMapper();
  
  // Currently using a single isolate (null mapper)
  const mapFilePathToIsolateId = null;
  
  // Set a reasonable idle timeout (5 seconds)
  const isolateMaxIdleTime = 5000;
  
  return {
    ...baseAdapters,
    // Uncomment to use worker isolates instead of subprocesses
    // isolateType: 'worker',
    mapFilePathToIsolateId,
    isolateMaxIdleTime,
    permissions: { 
      "allow-sys": true 
    }
  };
}

