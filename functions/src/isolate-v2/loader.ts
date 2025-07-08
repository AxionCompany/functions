
import { bundle } from "jsr:@deno/emit@0.46.0";
import { enhanceErrorWithSourceMap } from "./utils/sourceMapSupport.ts";

// A simple in-memory cache for bundled code to avoid redundant work.
const BUNDLE_CACHE = new Map<string, { code: string; dataUrl: string }>();

/**
 * Defines the structure of a successfully loaded and bundled module's exports.
 */
export interface LoadedModule {
    default?: (...args: any[]) => any;
    beforeRun?: (...args: any[]) => any;
    afterRun?: (...args: any[]) => any;
    GET?: (...args: any[]) => any;
    POST?: (...args: any[]) => any;
    PUT?: (...args: any[]) => any;
    DELETE?: (...args: any[]) => any;
    PATCH?: (...args: any[]) => any;
    OPTIONS?: (...args: any[]) => any;
    HEAD?: (...args: any[]) => any;
    [key: string]: any; // Allow other exports
}

interface ModuleLoaderOptions {
    projectPath: string;
    loaderUrl?: string;
}

/**
 * The ModuleLoader class is responsible for loading, bundling, and caching
 * remote or local TypeScript/JavaScript modules.
 */
export class ModuleLoader {
    private projectPath: string;
    private loaderUrl?: string;

    constructor(options: ModuleLoaderOptions) {
        this.projectPath = options.projectPath;
        this.loaderUrl = options.loaderUrl;
    }
    
    /**
     * Loads a module from the given URL and returns its exports.
     * @param importUrl The URL of the module to load.
     * @param bustCache If true, bypasses the bundle cache.
     * @returns A promise that resolves to the module's exports.
     */
    public async load(importUrl: string, bustCache = false): Promise<LoadedModule> {
        try {
            const { code, dataUrl } = await this.bundle(importUrl, bustCache);
            try {
                // The imported module contains all the exports (default, named, etc.)
                const targetModule: LoadedModule = await import(dataUrl);
                return targetModule;
            } catch (importError) {
                // Enhance the error with source map data for better debugging
                let error = importError instanceof Error ? importError : new Error(String(importError));
                const enhancedError = enhanceErrorWithSourceMap(error, code, importUrl);
                
                if ('applyMappedStack' in enhancedError) {
                    await (enhancedError as any).applyMappedStack(importUrl);
                }

                throw enhancedError;
            }
        } catch (error) {
            console.error(`[IsolateV2] Failed to load module from ${importUrl}:`, error);
            throw error;
        }
    }

    /**
     * Bundles the module at the given URL into a self-contained data URL.
     * It uses an in-memory cache to avoid re-bundling unchanged modules.
     * @param moduleUrl The URL of the module to bundle.
     * @param bustCache If true, forces a re-bundle.
     * @param useCacheForProbe If false, bypasses the cache entirely (for existence checks).
     * @returns A promise that resolves to the bundled code and its data URL.
     */
    public async bundle(moduleUrl: string, bustCache: boolean, useCacheForProbe = true): Promise<{ code: string, dataUrl: string }> {
        if (useCacheForProbe && !bustCache && BUNDLE_CACHE.has(moduleUrl)) {
            return BUNDLE_CACHE.get(moduleUrl)!;
        }

        // When busting cache, we also clear our in-memory cache and Deno's internal emit cache for that origin.
        if (bustCache) {
            BUNDLE_CACHE.delete(moduleUrl);
            try {
                const denoDir = Deno.env.get('DENO_DIR');
                if (denoDir) {
                    const origin = new URL(moduleUrl).origin;
                    // Deno escapes the origin to create a valid directory name.
                    const cacheFolderName = origin.replace(/^https?:\/\//, '').replace(/:/g, '_PORT');
                    const cacheFolder = `${denoDir}/remote/http/${cacheFolderName}`;
                    
                    await Deno.remove(cacheFolder, { recursive: true });
                    console.log(`[Cache] Deno cache for origin ${origin} cleared.`);
                }
            } catch (error) {
                // It's perfectly fine if the directory doesn't exist. We only care about other errors.
                if (!(error instanceof Deno.errors.NotFound)) {
                    console.warn(`[Cache] Could not clear Deno cache folder:`, error);
                }
            }
        }

        const result = await bundle(new URL(moduleUrl), {
            allowRemote: true,
            compilerOptions: {
                inlineSourceMap: true,
                inlineSources: true,
            },
        });

        const dataUrl = `data:text/javascript;base64,${btoa(result.code)}`;
        const bundleResult = { code: result.code, dataUrl };
        
        if (useCacheForProbe) {
            BUNDLE_CACHE.set(moduleUrl, bundleResult);
        }

        return bundleResult;
    }
} 