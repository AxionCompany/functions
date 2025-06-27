/**
 * Isolate-Based Upgrade Manager
 * 
 * Centralized upgrade logic following DRY and KISS principles:
 * - Development: Instant upgrades on file changes (except 'data' folder)
 * - Production: Adapter-controlled scheduled upgrades per isolate
 */

import { logInfo, logDebug } from "./logger.ts";

interface UpgradeConfig {
  env: string;
  projectPath?: string;
}

class UpgradeManager {
  private isolateUpgrades = new Map<string, boolean>(); // Per-isolate upgrade flags
  private config: UpgradeConfig;
  private fileWatcher?: AsyncIterable<Deno.FsEvent>;

  constructor(config: UpgradeConfig) {
    this.config = config;
    this.initializeUpgradeStrategy();
  }

  /**
   * Initialize the appropriate upgrade strategy based on environment
   */
  private initializeUpgradeStrategy(): void {
    if (this.config.env === 'development') {
      this.startFileWatcher();
    }
    // Production upgrades are handled via adapter calls to triggerUpgrade()
  }

  /**
   * Start file watcher for development mode
   */
  private async startFileWatcher(): Promise<void> {
    if (!this.config.projectPath) return;

    logInfo('Starting development file watcher for instant upgrades');
    
    try {
      const watcher = Deno.watchFs(this.config.projectPath, { recursive: true });
      this.fileWatcher = watcher;
      logDebug('File watcher started for development mode');

      // Process file changes in background
      this.processFileChanges();
    } catch (error) {
      logInfo('File watcher not available:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Process file changes and trigger upgrades for all isolates in development
   */
  private async processFileChanges(): Promise<void> {
    if (!this.fileWatcher) return;

    try {
      for await (const event of this.fileWatcher) {
        // Only handle file modifications for relevant file types
        if (event.kind === "modify" && this.isRelevantFile(event.paths)) {
          const files = event.paths.map((path: string) => path.replace(this.config.projectPath!, ''));
          
          logInfo('Files modified:', files, '- triggering upgrades for all isolates');
          this.triggerUpgradeForAll();
        }
      }
    } catch (error) {
      logDebug('File watcher stopped:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Check if file change is relevant for upgrades
   */
  private isRelevantFile(paths: string[]): boolean {
    return paths.some(path => {
      // Skip data folder (Deno cache)
      if (path.includes('/data/') || path.includes('\\data\\')) {
        return false;
      }
      
      // Only relevant file types
      return /\.(html|js|jsx|tsx|ts|json)$/.test(path);
    });
  }

  /**
   * Trigger an upgrade for a specific isolate (called by adapters in production)
   */
  triggerUpgrade(isolateId: string): void {
    this.isolateUpgrades.set(isolateId, true);
    logDebug(`Upgrade triggered for isolate: ${isolateId}`);
  }

  /**
   * Trigger upgrades for all isolates (used in development mode)
   */
  triggerUpgradeForAll(): void {
    // In development, we want to upgrade all isolates when files change
    if (this.config.env === 'development') {
      // Set a special flag for "all isolates"
      this.isolateUpgrades.set('*', true);
      logDebug('Upgrade triggered for all isolates (development mode)');
    }
  }

  /**
   * Check if a specific isolate should upgrade now and reset the flag
   */
  shouldUpgradeNow(isolateId: string): boolean {
    // Check isolate-specific upgrade flag
    const isolateNeedsUpgrade = this.isolateUpgrades.get(isolateId);
    
    // Check global upgrade flag (development mode)
    const allNeedUpgrade = this.isolateUpgrades.get('*');
    
    if (isolateNeedsUpgrade) {
      this.isolateUpgrades.delete(isolateId);
      logDebug(`Isolate ${isolateId} should upgrade (isolate-specific)`);
      return true;
    }
    
    if (allNeedUpgrade) {
      // Don't delete the '*' flag here, let it be cleaned up elsewhere
      logDebug(`Isolate ${isolateId} should upgrade (global development mode)`);
      return true;
    }
    
    return false;
  }

  /**
   * Clear the global upgrade flag (used after processing in development)
   */
  clearGlobalUpgradeFlag(): void {
    this.isolateUpgrades.delete('*');
    logDebug('Cleared global upgrade flag');
  }

  /**
   * Get all isolates that need upgrading
   */
  getIsolatesNeedingUpgrade(): string[] {
    const isolates = Array.from(this.isolateUpgrades.keys()).filter(id => id !== '*');
    const hasGlobalUpgrade = this.isolateUpgrades.has('*');
    
    if (hasGlobalUpgrade) {
      logDebug('Global upgrade flag set - all isolates need upgrading');
      return ['*']; // Special indicator for "all isolates"
    }
    
    return isolates;
  }

  /**
   * Clear upgrade flag for a specific isolate
   */
  clearUpgradeFlag(isolateId: string): void {
    this.isolateUpgrades.delete(isolateId);
    logDebug(`Cleared upgrade flag for isolate: ${isolateId}`);
  }

  /**
   * Get debug info about current upgrade state
   */
  getUpgradeState(): Record<string, boolean> {
    return Object.fromEntries(this.isolateUpgrades.entries());
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // File watcher cleanup is handled automatically by Deno
    this.fileWatcher = undefined;
    this.isolateUpgrades.clear();
  }
}

// Global upgrade manager instance
let upgradeManager: UpgradeManager | null = null;

/**
 * Initialize the upgrade manager
 */
export function initializeUpgradeManager(config: UpgradeConfig): void {
  if (upgradeManager) {
    upgradeManager.cleanup();
  }
  upgradeManager = new UpgradeManager(config);
}

/**
 * Trigger an upgrade for a specific isolate (for use in adapters)
 */
export function triggerUpgrade(isolateId: string): void {
  if (!isolateId) {
    logDebug('Cannot trigger upgrade: isolateId is required');
    return;
  }
  upgradeManager?.triggerUpgrade(isolateId);
}

/**
 * Trigger upgrades for all isolates (development mode)
 */
export function triggerUpgradeForAll(): void {
  upgradeManager?.triggerUpgradeForAll();
}

/**
 * Check if a specific isolate should upgrade now
 */
export function shouldUpgradeNow(isolateId: string): boolean {
  if (!isolateId) {
    logDebug('Cannot check upgrade status: isolateId is required');
    return false;
  }
  return upgradeManager?.shouldUpgradeNow(isolateId) ?? false;
}

/**
 * Clear the global upgrade flag (used in development)
 */
export function clearGlobalUpgradeFlag(): void {
  upgradeManager?.clearGlobalUpgradeFlag();
}

/**
 * Get all isolates that need upgrading
 */
export function getIsolatesNeedingUpgrade(): string[] {
  return upgradeManager?.getIsolatesNeedingUpgrade() ?? [];
}

/**
 * Clear upgrade flag for a specific isolate
 */
export function clearUpgradeFlag(isolateId: string): void {
  upgradeManager?.clearUpgradeFlag(isolateId);
}

/**
 * Get debug info about current upgrade state
 */
export function getUpgradeState(): Record<string, boolean> {
  return upgradeManager?.getUpgradeState() ?? {};
}

/**
 * Cleanup upgrade manager
 */
export function cleanupUpgradeManager(): void {
  upgradeManager?.cleanup();
  upgradeManager = null;
} 