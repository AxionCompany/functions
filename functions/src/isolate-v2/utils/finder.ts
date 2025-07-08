import { dirname, resolve } from "jsr:@std/path@1.1.1";
import type { ModuleLoader } from "../loader.ts";

export interface FileSearchResult {
    path: string;
    name: string;
}

/**
 * Finds contextual modules by walking up the directory tree from a starting path.
 * This supports both local file paths and remote URLs.
 */
export async function findContextualModules(importUrl: string, loader: ModuleLoader, contextualModuleNames: string[]): Promise<FileSearchResult[]> {
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
                    const bundleResult = await loader.bundle(potentialModulePath, true, false);
                    if (!bundleResult.code) {
                        seen.add(potentialModulePath);
                        continue;
                    }
                    modules.push({ path: potentialModulePath, name });
                } catch (e: unknown) {
                    // It's okay if the file doesn't exist, just ignore the error.
                    // A 404 or "Not Found" error is the expected outcome for non-existent files.
                    if (e instanceof Deno.errors.NotFound || (e as Error).message?.includes('404')) {
                        // ignore
                    } else {
                        console.warn(`[Finder] Error probing for ${potentialModulePath}:`, (e as Error).message);
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