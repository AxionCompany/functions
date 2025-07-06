/**
 * Oxian.js Adapters Configuration
 * 
 * This file configures how requests are handled, including:
 * - Database configuration per isolate
 * - Isolate management and load balancing
 * - Authentication and permissions
 * - Upgrade management
 */

import type { AdapterConfig } from "./src/utils/adapters.ts";

/**
 * Enhanced adapter configuration with isolate settings
 */
export interface IsolateAdapterConfig extends AdapterConfig {
  /** Function to map file paths to isolate IDs */
  mapFilePathToIsolateId?: ((params: { formattedFileUrl: string, fileUrl?: string }) => string) | null;
  /** Maximum idle time for isolates in milliseconds */
  isolateMaxIdleTime?: number;
  /** Isolate type (worker or subprocess) */
  isolateType?: 'worker' | 'subprocess';
  /** Database configuration */
  database?: {
    enabled: boolean;
    remoteURL?: string;
    lwwColumn?: string;
    edgeId?: string;
  };
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
function createRoundRobinMapper() {
  return () => {
    // Increment the isolate index and wrap around
    currentIsolateIndex = (currentIsolateIndex + 1) % MAX_ISOLATES;
    return String(currentIsolateIndex);
  };
}

/**
 * Helper function to extract isolate ID from request context
 * 
 * @param adapterData - The adapter configuration data
 */
function getIsolateIdForRequest(adapterData: any): string {
  try {
    const url = new URL(adapterData.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Strategy 1: Use first path segment for API routes
    if (pathParts[0] === 'api' && pathParts[1]) {
      return `api_${pathParts[1]}`;
    }
    
    // Strategy 2: Use domain-based isolation for multi-tenant
    if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      return url.hostname.replace(/\./g, '_');
    }
    
    // Strategy 3: Round-robin for other requests
    return createRoundRobinMapper()();
    
  } catch (error) {
    console.warn('Error extracting isolate ID:', error);
    // Default isolate for other requests
    return 'default';
  }
}

/**
 * Enhanced database configuration function
 * 
 * @param isolateId - The isolate identifier
 * @param env - Environment variables
 * @returns Database configuration
 */
function getDatabaseConfig(isolateId: string, env: Record<string, string> = {}) {
  // Example: Only enable database for API isolates
  if (!isolateId.startsWith('api_')) {
    return {
      enabled: false
    };
  }

  return {
    enabled: true,
    // url: env.DATABASE_URL,
    syncUrl: env.DATABASE_URL,
    lwwColumn: 'updated_at',
    edgeId: `${isolateId}_${env.INSTANCE_ID || 'local'}`,
  };
}

/**
 * Trigger an isolate-specific upgrade
 * 
 * @param isolateId - The isolate to upgrade
 */
function triggerUpgrade(isolateId: string) {
  console.log(`[Adapter] Triggering upgrade for isolate: ${isolateId}`);
  // Implementation depends on your deployment strategy
  // Could trigger a restart, reload modules, update dependencies, etc.
}

/**
 * Configures adapters with isolate settings
 * 
 * @param baseAdapters - Base adapter configuration
 * @returns Enhanced adapter configuration with isolate settings
 */
export default function defaultAdapters(baseAdapters: any): IsolateAdapterConfig {
  // Get isolate ID for this request
  const isolateId = getIsolateIdForRequest(baseAdapters);

  // Get database configuration
  const database = getDatabaseConfig(isolateId, baseAdapters.env || {});

  // Example: Production upgrade logic per isolate
  if (baseAdapters.env?.ENV === 'production') {
    
    // Example 1: Time-based upgrades (every hour in production) for specific isolates
    if (isolateId.startsWith('api_')) {
      try {
        // Use isolate-specific timestamp key
        const timestampKey = `lastUpgradeTime_${isolateId}`;
        const lastUpgrade = parseInt(globalThis.localStorage?.getItem?.(timestampKey) || '0');
        const oneHour = 60 * 60 * 1000;
        
        if (Date.now() - lastUpgrade > oneHour) {
          globalThis.localStorage?.setItem?.(timestampKey, Date.now().toString());
          // Trigger upgrade for this specific isolate
          triggerUpgrade(isolateId);
        }
      } catch (error) {
        // LocalStorage may not be available in all environments
        console.debug('LocalStorage not available for upgrade tracking');
      }
    }
  }

  // Default configuration
  return {
    ...baseAdapters,
    
    // Enhanced database configuration
    database,
    
    // Isolate configuration
    isolateType: 'subprocess', // or 'worker'
    isolateMaxIdleTime: database.enabled ? 30000 : 5000, // Longer for DB isolates
    
    // Store the isolate ID for debugging/logging
    currentIsolateId: isolateId,
    
    // File loader configuration for remote repositories
    loaderConfig: {
      // For local development, these are ignored
      // For production with remote repos:
      // username: `github--owner--repo--branch--${isolateId}`, // Include isolate context
      // password: 'github_token_or_api_key'
    }
  };
}

