import { dirname, resolve } from "jsr:@std/path@1.1.1";
import type { ModuleLoader } from "../loader.ts";
import type { IsolateConfig } from "../types.ts";

export interface FileSearchResult {
    path: string;
    name: string;
}

/**
 * Finds contextual modules by walking up the directory tree from a starting path.
 * This supports both local file paths and remote URLs.
 */
export async function findContextualModules(importUrl: string, loader: ModuleLoader, contextualModuleNames: string[], config: IsolateConfig): Promise<FileSearchResult[]> {
    const isRemote = importUrl.startsWith('http');
    const modules: FileSearchResult[] = [];
    const seen = new Set<string>();

    let currentPath = isRemote ? new URL(importUrl).pathname : importUrl.replace('file://', '');
    let currentUrlDir = isRemote ? new URL(".", importUrl).href : `file://${dirname(currentPath)}/`;

    // Walk up the directory tree
    while (currentPath && currentPath !== '/') {
        for (const name of contextualModuleNames) {
            // Construct the full path for the potential module
            const potentialModulePath = isRemote
                ? new URL(`${name}.ts`, currentUrlDir).href
                : `file://${resolve(dirname(currentPath), `${name}.ts`)}`;

            if (!seen.has(potentialModulePath)) {
                try {
                    // Probe for the file's existence by trying to bundle it without caching the result.
                    const bundleResult = await loader.bundle(potentialModulePath, true, false, config);
                    if (!bundleResult.code) {
                        seen.add(potentialModulePath);
                        continue;
                    }
                    modules.push({ path: potentialModulePath, name });
                } catch (e: unknown) {
                    // It's okay if the file doesn't exist; ignore common bundler probe failures
                    const msg = (e as Error)?.message || "";
                    const isNotFound = e instanceof Deno.errors.NotFound || msg.includes('404');
                    const isBundlerMissing =
                        msg.includes('unexpectedly missing when bundling') ||
                        msg.includes('Unable to output during bundling') ||
                        msg.includes('Bundler.loader.load') ||
                        msg.includes('failed to analyze module') ||
                        msg.includes('Cannot resolve');

                    if (isNotFound || isBundlerMissing) {
                        // ignore silently during probe
                    } else if ((config as any)?.debugLogs) {
                        console.warn(`[Finder] Error probing for ${potentialModulePath}:`, msg);
                    }
                }
            }
        }

        // Move to the parent directory
        const parentPath = dirname(currentPath);
        if (parentPath === currentPath) break; // Reached root
        currentPath = parentPath;
        currentUrlDir = isRemote ? new URL("..", currentUrlDir).href : `file://${dirname(currentPath)}/`;
    }

    // The order is important: shared should be first, then middleware, etc.
    // The traversal finds files from deepest to shallowest, so we reverse.
    return modules.reverse();
} 