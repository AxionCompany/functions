
import { bundle } from "jsr:@deno/emit@0.46.0";
import { enhanceErrorWithSourceMap } from "./utils/sourceMapSupport.ts";
import type { IsolateConfig } from "./types.ts";
import createFileLoader from "../file-loader/main.ts";
import { SEPARATOR, basename, extname, join, dirname } from "jsr:@std/path@1.1.0";

// A simple in-memory cache for bundled code to avoid redundant work.
const BUNDLE_CACHE = new Map<string, { code: string; dataUrl: string }>();

// Regexes to capture node:/npm:/jsr: import/export statements
const SPECIAL_SCHEMES = ["node", "npm", "jsr"] as const;
const SPECIAL_IMPORT_PATTERNS: RegExp[] = [
    // import ... from 'scheme:...'
    new RegExp(String.raw`(^|\n)\s*import\s+[^;]*\s+from\s+['"](?:${SPECIAL_SCHEMES.join("|")}):[^'"\n]+['"];?`, "g"),
    // import 'scheme:...'
    new RegExp(String.raw`(^|\n)\s*import\s+['"](?:${SPECIAL_SCHEMES.join("|")}):[^'"\n]+['"];?`, "g"),
    // export * from 'scheme:...'
    new RegExp(String.raw`(^|\n)\s*export\s+\*\s+from\s+['"](?:${SPECIAL_SCHEMES.join("|")}):[^'"\n]+['"];?`, "g"),
    // export { ... } from 'scheme:...'
    new RegExp(String.raw`(^|\n)\s*export\s+\{[^}]*\}\s+from\s+['"](?:${SPECIAL_SCHEMES.join("|")}):[^'"\n]+['"];?`, "g"),
];

function suppressSpecialImports(source: string, collector: Set<string>): string {
    let modified = source;
    for (const pattern of SPECIAL_IMPORT_PATTERNS) {
        modified = modified.replace(pattern, (m) => {
            const stmt = m.startsWith("\n") ? m.trimStart() : m.trim();
            if (stmt) collector.add(stmt.replace(/^\n+/, ""));
            // Preserve line count: replace matched text with same number of newlines (at least one)
            const newlineCount = (m.match(/\n/g) || []).length;
            const replacement = "\n".repeat(Math.max(1, newlineCount));
            return replacement;
        });
    }
    return modified;
}

function extractMatchedPath(content: string): string | undefined {
  const m = content.match(/export const matchedPath_[a-zA-Z0-9_]+\s*=\s*"([^"]+)"/);
  return m?.[1];
}

function canonicalizeMatchedPath(p: string, config: IsolateConfig): string {
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(p)) return p; // already a URL (file:, http:, etc.)
  if (p.startsWith('/')) return `file://${p}`;
  const base = (config.functionsDir || config.projectPath).replace(/\/$/, '');
  return `file://${base}/${p.replace(/^\/+/, '')}`;
}

function extractPathParams(content: string): Record<string, string> {
  const m = content.match(/export const pathParams_[a-zA-Z0-9_]+\s*=\s*({[^}]*})/);
  return m?.[1] ? JSON.parse(m[1]) : {};
}


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

async function loadViaFileLoaderMain(config: IsolateConfig, specifier: string): Promise<string | undefined> {
  const projectPath = (config.projectPath || Deno.cwd()).replace(/\/$/, "");
  const functionsDir = (config.functionsDir || config.projectPath || Deno.cwd()).replace(/\/$/, "");
  const functionsRel = functionsDir.startsWith(projectPath)
    ? functionsDir.slice(projectPath.length).replace(/^\/+/, "")
    : "";

  // Build file-loader main instance
  const fileLoader = createFileLoader({
    config: {
      loaderType: "local",
      dirEntrypoint: config.fileLoader?.dirEntrypoint || "index",
      debug: false,
      useCache: true,
    } as any,
    modules: {
      path: { SEPARATOR, basename, extname, join, dirname },
    } as any,
  });

  // Prepare pathname relative to project root and prefixed with functionsRel
  let pathname: string;
  try {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(specifier)) {
      const u = new URL(specifier);
      const abs = u.pathname;
      const relPrefix = `/${functionsRel}`;
      if (abs.startsWith(projectPath)) {
        pathname = "/" + abs.slice(projectPath.length).replace(/^\/+/, "");
      } else if (abs.startsWith(functionsDir)) {
        pathname = "/" + functionsRel + "/" + abs.slice(functionsDir.length).replace(/^\/+/, "");
      } else if (abs === relPrefix || abs.startsWith(relPrefix + "/")) {
        // Already under /functionsRel
        pathname = abs;
      } else {
        // Fallback: prefix with functionsRel
        pathname = "/" + functionsRel + "/" + abs.replace(/^\/+/, "");
      }
    } else {
      // Route-like or relative specifier
      const raw = specifier.startsWith("/") ? specifier : `/${specifier}`;
      pathname = `/${functionsRel}${raw}`.replace(/\/+/g, "/");
    }
  } catch {
    const raw = specifier.startsWith("/") ? specifier : `/${specifier}`;
    pathname = `/${functionsRel}${raw}`.replace(/\/+/g, "/");
  }


  // Follow redirect logic up to a few times
  let attempts = 0;
  while (attempts < 3) {
    attempts++;
    const result = await fileLoader(
      {
        queryParams: {},
        headers: { "content-type": "text/plain; charset=utf-8" },
        pathname,
        url: new URL(`http://local${pathname}`),
        data: {},
      } as any,
      {
        status: () => ({} as any),
        statusText: () => ({} as any),
        headers: () => ({} as any),
        redirect: (url: string) => ({ __redirect__: true, url }) as any,
      } as any,
    );

    // Handle redirect
    if (result && typeof result === "object" && "__redirect__" in result && (result as any).url) {
      try {
        const redirected = new URL((result as any).url as string);
        pathname = redirected.pathname;
        continue;
      } catch {
        break;
      }
    }

    if (typeof result === "string") {
      return result;
    }

    break;
  }

  return undefined;
}

async function createCustomLoader(config: IsolateConfig, collector: Set<string>, loader: ModuleLoader, moduleUrl: string, requestId?: string) {
    return async (specifier: string): Promise<{ kind: "module"; specifier: string; content: string } | undefined> => {
        try {
            // Bypass bundling for special schemes; they are suppressed from parent sources
            if (
                specifier.startsWith("node:") ||
                specifier.startsWith("npm:") ||
                specifier.startsWith("jsr:") ||
                // Let deno_emit handle import maps and other non-code data/blobs
                specifier.startsWith("data:") ||
                specifier.startsWith("blob:")

            ) {
                return undefined;
            }

            // Always resolve content via file-loader main for everything else
            const contentRaw = await loadViaFileLoaderMain(config, specifier);
            if (contentRaw) {
                const content = suppressSpecialImports(contentRaw, collector);
                const matched = extractMatchedPath(contentRaw);
                const pathParams = extractPathParams(contentRaw);
                const canonical = matched ? canonicalizeMatchedPath(matched, config) : specifier;
                if (requestId) loader.setPathParamsForRequest(requestId, moduleUrl, pathParams);
                return { kind: "module", specifier: canonical, content };
            }

            return undefined;
        } catch (error) {
            console.warn(`[IsolateV2] Error in custom loader for ${specifier}:`, error);
            return undefined;
        }
    };
}

/**
 * The ModuleLoader class is responsible for loading, bundling, and caching
 * remote or local TypeScript/JavaScript modules.
 */
export class ModuleLoader {
    private projectPath: string;
    private loaderUrl?: string;
    private pathParamsByRoot: Map<string, Record<string, string>> = new Map();
    private pathParamsByRequest: Map<string, Map<string, Record<string, string>>> = new Map();

    constructor(options: ModuleLoaderOptions) {
        this.projectPath = options.projectPath;
        this.loaderUrl = options.loaderUrl;
    }

    /**
     * Retrieve bundled code for a given module URL, if available.
     */
    public getBundledCode(moduleUrl: string): string | undefined {
        const cached = BUNDLE_CACHE.get(moduleUrl);
        return cached?.code;
    }

    /**
     * Resolve path params for the given root import URL without rebundling code.
     * Uses the same file-loader main logic to compute them for the current request.
     */
    public async resolvePathParams(importUrl: string, config: IsolateConfig): Promise<Record<string, string>> {
        try {
            const contentRaw = await loadViaFileLoaderMain(config, importUrl);
            if (!contentRaw) return {};
            const params = extractPathParams(contentRaw) || {};
            const requestId = (config as any).requestId as string | undefined;
            if (requestId && Object.keys(params).length > 0) {
                this.setPathParamsForRequest(requestId, importUrl, params);
            }
            return params;
        } catch {
            return {};
        }
    }

    public setPathParamsForRoot(rootUrl: string, params: Record<string, string>): void {
        if (params && Object.keys(params).length > 0) {
            this.pathParamsByRoot.set(rootUrl, params);
        }
    }

    public getPathParamsForRoot(rootUrl: string): Record<string, string> | undefined {
        return this.pathParamsByRoot.get(rootUrl);
    }

    public setPathParamsForRequest(requestId: string, rootUrl: string, params: Record<string, string>): void {
        if (!requestId || !params || Object.keys(params).length === 0) return;
        const byRoot = this.pathParamsByRequest.get(requestId) ?? new Map<string, Record<string, string>>();
        byRoot.set(rootUrl, params);
        this.pathParamsByRequest.set(requestId, byRoot);
    }

    public getPathParamsForRequest(requestId: string, rootUrl: string): Record<string, string> | undefined {
        return this.pathParamsByRequest.get(requestId)?.get(rootUrl);
    }

    public clearPathParamsForRequest(requestId: string): void {
        this.pathParamsByRequest.delete(requestId);
    }

    public async load(importUrl: string, bustCache = false, config: IsolateConfig): Promise<LoadedModule> {
        try {
            const { code, dataUrl } = await this.bundle(importUrl, bustCache, true, config);
            try {
                const targetModule: LoadedModule = await import(dataUrl);
                return targetModule;
            } catch (importError) {
                let error = importError instanceof Error ? importError : new Error(String(importError));
                const enhancedError = enhanceErrorWithSourceMap(error, code, importUrl);

                if ("applyMappedStack" in enhancedError) {
                    await (enhancedError as any).applyMappedStack(importUrl);
                }

                throw enhancedError;
            }
        } catch (error) {
            console.error(`[IsolateV2] Failed to load module from ${importUrl}:`, error);
            throw error;
        }
    }

    public async bundle(moduleUrl: string, bustCache: boolean, useCacheForProbe = true, config: IsolateConfig, requestId?: string): Promise<{ code: string; dataUrl: string }> {
        if (useCacheForProbe && !bustCache && BUNDLE_CACHE.has(moduleUrl)) {
            return BUNDLE_CACHE.get(moduleUrl)!;
        }

        if (bustCache) {
            BUNDLE_CACHE.delete(moduleUrl);
            try {
                const denoDir = Deno.env.get("DENO_DIR");
                if (denoDir) {
                    const origin = new URL(moduleUrl).origin;
                    const cacheFolderName = origin.replace(/^https?:\/\//, "").replace(/:/g, "_PORT");
                    const cacheFolder = `${denoDir}/remote/http/${cacheFolderName}`;

                    await Deno.remove(cacheFolder, { recursive: true });
                    console.log(`[Cache] Deno cache for origin ${origin} cleared.`);
                }
            } catch (error) {
                if (!(error instanceof Deno.errors.NotFound)) {
                    console.warn(`[Cache] Could not clear Deno cache folder:`, error);
                }
            }
        }

        const bundleOptions: any = {
            allowRemote: true,
            compilerOptions: {
                inlineSourceMap: true,
                inlineSources: true,
            },
        };

        if (config.denoConfig?.imports || config.denoConfig?.scopes) {
            bundleOptions.importMap = "data:application/json," + encodeURIComponent(
                JSON.stringify({
                    imports: config.denoConfig.imports,
                    scopes: config.denoConfig.scopes,
                }),
            );
        }



        // Always use our custom loader; create a per-bundle collector and pass it along
        const suppressedSpecialImports = new Set<string>();
        const reqId = (config as any).requestId ?? requestId;
        bundleOptions.load = await createCustomLoader(config, suppressedSpecialImports, this, moduleUrl, reqId);

        const result = await bundle(new URL(moduleUrl), bundleOptions);


        // Reinstate suppressed special imports at the end of the bundle to preserve source-map line numbers
        let finalCode = result.code;
        if (suppressedSpecialImports.size > 0) {
            const reinjected = Array.from(suppressedSpecialImports).join("\n");
            finalCode = `${finalCode}\n${reinjected}`;
            suppressedSpecialImports.clear();
        }

        const encoder = new TextEncoder();
        const codeBytes = encoder.encode(finalCode);
        let binaryString = "";
        for (let i = 0; i < codeBytes.length; i++) {
            binaryString += String.fromCharCode(codeBytes[i]);
        }
        const base64Code = btoa(binaryString);
        const dataUrl = `data:text/javascript;base64,${base64Code}`;
        const bundleResult = { code: finalCode, dataUrl };

        if (useCacheForProbe) {
            BUNDLE_CACHE.set(moduleUrl, bundleResult);
        }

        return bundleResult;
    }
} 