/**
 * Default Oxian.js Adapters
 * 
 * This file provides the default adapters for the Oxian.js framework.
 * Adapters allow customization of core framework behavior.
 */

import { triggerUpgrade } from "./src/utils/upgradeManager.ts";
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
 * Helper function to extract isolate ID from request context
 * This could be based on URL patterns, user ID, project ID, etc.
 */
function getIsolateIdForRequest(adapterData: any): string {
  // Example: Extract from URL path
  const url = new URL(adapterData.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  
  // Example strategies:
  // 1. Use project name from path: /api/projectA/function -> "projectA"
  // 2. Use user ID from headers: Authorization header -> "user123" 
  // 3. Use environment: staging, production -> "staging", "production"
  // 4. Use file extension: .jsx/.tsx -> "jsx", .js/.ts -> "js"
  
  // For this example, let's use a simple approach:
  // If path starts with /api/, use the next segment as project identifier
  if (pathParts[0] === 'api' && pathParts[1]) {
    return `project_${pathParts[1]}`;
  }
  
  // Default isolate for other requests
  return 'default';
}

/**
 * Configures adapters with isolate settings
 * 
 * @param baseAdapters - Base adapter configuration
 * @returns Enhanced adapter configuration with isolate settings
 */
export default function defaultAdapters(baseAdapters: any) {
  // Get isolate ID for this request
  const isolateId = getIsolateIdForRequest(baseAdapters);
  
  // Example: Production upgrade logic per isolate
  // This is where applications can implement their own upgrade strategies
  
  // Example 1: Time-based upgrades (every hour in production) for specific isolates
  if (baseAdapters.env?.ENV === 'production') {
    // Use isolate-specific timestamp key
    const timestampKey = `lastUpgradeTime_${isolateId}`;
    const lastUpgrade = (globalThis as any)[timestampKey] || 0;
    const hoursSinceLastUpgrade = (Date.now() - lastUpgrade) / (1000 * 60 * 60);
    
    if (hoursSinceLastUpgrade >= 1) {
      // Trigger upgrade for this specific isolate
      triggerUpgrade(isolateId);
      (globalThis as any)[timestampKey] = Date.now();
    }
  }

  // Example 2: External signal-based upgrades for specific isolates
  // if (shouldCheckForUpgrade(isolateId)) {
  //   triggerUpgrade(isolateId);
  // }

  // Example 3: Version-based upgrades for specific projects
  // if (getCurrentVersion(isolateId) !== getTargetVersion(isolateId)) {
  //   triggerUpgrade(isolateId);
  // }

  // Example 4: Feature flag based upgrades
  // if (isFeatureFlagEnabled('new_version', isolateId)) {
  //   triggerUpgrade(isolateId);
  // }

  // Default configuration
  return {
    ...baseAdapters,
    // Isolate configuration
    isolateType: 'worker', // or 'worker'
    isolateMaxIdleTime: 5000,   // 5 seconds
    
    // Store the isolate ID for debugging/logging
    currentIsolateId: isolateId,
    
    // File loader configuration for remote repositories
    loaderConfig: {
      // For local development, these are ignored
      // For production with remote repos:
      // username: `github--owner--repo--branch--${isolateId}`, // Include isolate context
      // password: 'github_token_or_api_key'
    },
    
    // // Permissions
    // permissions: { 
    //   "allow-sys": true ,
    //   'allow-env': true,
    // }
  };
}

// Helper functions for production upgrade strategies
// (These are examples - implement according to your needs)

// function shouldCheckForUpgrade(isolateId: string): boolean {
//   // Check external signal for specific isolate (database, file, API)
//   // For example: check if there's an upgrade flag for this specific project
//   return false;
// }

// function getCurrentVersion(isolateId: string): string {
//   // Get current deployed version for specific isolate
//   return "1.0.0";
// }

// function getTargetVersion(isolateId: string): string {
//   // Get target version for specific isolate from config/API
//   return "1.0.0";
// }

// function isFeatureFlagEnabled(flagName: string, isolateId: string): boolean {
//   // Check if feature flag is enabled for specific isolate
//   return false;
// }

