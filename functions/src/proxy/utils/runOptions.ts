/**
 * Configuration interface for Deno permissions
 */
export interface PermissionsConfig {
  'allow-run'?: boolean | string[];
  'deny-run'?: boolean;
  'allow-env'?: boolean | string[];
  'allow-write'?: boolean | string[];
  'allow-read'?: boolean | string[];
  'allow-import'?: boolean;
  'allow-ffi'?: boolean;
  'allow-net'?: boolean | string[];
  'unstable-sloppy-imports'?: boolean;
  'unstable-kv'?: boolean;
  'unstable'?: boolean;
  'no-lock'?: boolean;
  'no-prompt'?: boolean;
  'import-map'?: string;
  [key: string]: boolean | string | string[] | undefined;
}

/**
 * Configuration for the isolate environment
 */
export interface IsolateConfig {
  isolateType: 'subprocess' | 'worker';
  projectId: string;
  projectPath: string;
  denoConfig?: {
    imports?: Record<string, string>;
    scope?: Record<string, Record<string, string>>;
  };
  [key: string]: any;
}

/**
 * Context for generating run options
 */
export interface RunOptionsContext {
  config: IsolateConfig;
  variables: Record<string, string>;
  modules: {
    template: (template: string, variables: Record<string, string>) => string;
    [key: string]: any;
  };
}

/**
 * Get platform-specific user cache directories
 * This is needed for @deno/emit WebAssembly caching
 */
function getUserCacheDirectories(): string[] {
  const platform = Deno.build.os;
  const homeDir = Deno.env.get("HOME") || Deno.env.get("USERPROFILE") || ".";
  
  switch (platform) {
    case "darwin": // macOS
      return [
        `${homeDir}/Library/Application Support/deno-wasmbuild`,
        `${homeDir}/Library/Caches/deno-wasmbuild`,
      ];
    case "linux":
      const xdgCacheHome = Deno.env.get("XDG_CACHE_HOME");
      const xdgDataHome = Deno.env.get("XDG_DATA_HOME");
      return [
        xdgCacheHome ? `${xdgCacheHome}/deno-wasmbuild` : `${homeDir}/.cache/deno-wasmbuild`,
        xdgDataHome ? `${xdgDataHome}/deno-wasmbuild` : `${homeDir}/.local/share/deno-wasmbuild`,
      ];
    case "windows":
      const appData = Deno.env.get("APPDATA");
      const localAppData = Deno.env.get("LOCALAPPDATA");
      return [
        appData ? `${appData}/deno-wasmbuild` : `${homeDir}/AppData/Roaming/deno-wasmbuild`,
        localAppData ? `${localAppData}/deno-wasmbuild` : `${homeDir}/AppData/Local/deno-wasmbuild`,
      ];
    default:
      // Fallback for unknown platforms
      return [
        `${homeDir}/.cache/deno-wasmbuild`,
        `${homeDir}/.local/share/deno-wasmbuild`,
      ];
  }
}

/**
 * Generate Deno run options based on permissions configuration
 * 
 * @param customPermissions - Custom permissions to override defaults
 * @param context - Configuration context including config, variables, and modules
 * @returns Formatted permissions for subprocess or worker
 */
const runOptions = (
  customPermissions: Partial<PermissionsConfig> = {}, 
  context: RunOptionsContext
): string[] | Record<string, boolean | string[]> => {
  const { config, variables, modules } = context;

  // Determine read/write permissions based on isolate type
  const readWritePermissions = config.isolateType === 'subprocess'
    ? ['.']
    : [
        `${config.projectPath}`, 
        `${config.projectPath}/../node_modules`, 
        `${config.projectPath}/../../node_modules`
      ];

  // Get platform-specific cache directories for @deno/emit WebAssembly caching
  const cacheDirectories = getUserCacheDirectories();
  
  // Log the cache directories being added (useful for debugging)
  if (cacheDirectories.length > 0) {
    console.log(`[Permissions] Adding platform-specific cache directories for @deno/emit:`, cacheDirectories);
  }
  
  // Combine base read permissions with cache directories
  const readPermissions = [...readWritePermissions, ...cacheDirectories];

  // Build base permissions object
  const basePermissions: PermissionsConfig = {
    "deny-run": customPermissions['allow-run'] ? false : true,
    "allow-env": false,
    "allow-write": readWritePermissions,
    "allow-read": readPermissions,
    "allow-import": true,
    "allow-ffi": true,
    "allow-net": true,
    "unstable-sloppy-imports": true,
    "unstable-kv": true,
    "unstable": true,
    "no-lock": true,
    "no-prompt": true,
    "import-map": `data:application/json,${modules.template(
      JSON.stringify({ 
        imports: config?.denoConfig?.imports, 
        scope: config?.denoConfig?.scope 
      }), 
      variables
    )}`,
  };

  // Merge base permissions with custom permissions
  const mergedPermissions: PermissionsConfig = {
    ...basePermissions,
    ...customPermissions,
  };

  // Format permissions based on isolate type
  if (config.isolateType === 'subprocess') {
    // For subprocess, convert to command line arguments
    return Object.entries(mergedPermissions)
      .map(([key, value]) => {
        if (typeof value === 'undefined') return null;
        
        if (typeof value === 'boolean') {
          return value === true ? `--${key}` : null;
        }
        
        if (Array.isArray(value)) {
          return `--${key}=${value.join(",")}`;
        }
        
        if (typeof value === 'string') {
          return `--${key}=${value}`;
        }
        
        return null;
      })
      .filter(Boolean) as string[];
  } else {
    // For worker, convert to worker permissions object
    const workerPermissions: Record<string, boolean | string[]> = {};
    
    Object.entries(mergedPermissions).forEach(([key, value]) => {
      if (typeof value === 'undefined') return;
      
      const [concession, type] = key.split('-');
      if (concession === 'allow' && type) {
        workerPermissions[type] = value as boolean | string[];
      }
      // Note: deny-{...} permission is not yet implemented in Deno webworkers permissions (as of v1.44.5)
    });
    
    return workerPermissions;
  }
};

export default runOptions;