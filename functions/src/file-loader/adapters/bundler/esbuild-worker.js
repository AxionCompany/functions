// Web worker for esbuild bundling in Deno
import { context } from "npm:esbuild";
import { denoPlugins } from "https://deno.land/x/esbuild_deno_loader/mod.ts";
import replaceTemplate from "../../../utils/template.ts";

// Set up error handler for the worker
self.onerror = (error) => {
  console.error("[esbuild-worker] Uncaught error:", error);
  return true; // Prevent default handling
};

// Handle messages from the main thread
self.onmessage = async (event) => {
  const startTime = performance.now();
  const { id, path, options } = event.data;
  
  console.log(`[esbuild-worker] Received bundling request ${id} for ${path?.href || 'unknown path'}`);
  
  try {
    if (!path || !path.href) {
      throw new Error("Invalid path provided: path or path.href is undefined");
    }
    
    // Process bundling
    const result = await bundleFile(path, options);
    
    const duration = Math.round(performance.now() - startTime);
    console.log(`[esbuild-worker] Completed bundling request ${id} in ${duration}ms`);
    
    // Return result to main thread
    self.postMessage({
      id,
      success: true,
      result
    });
  } catch (error) {
    console.error(`[esbuild-worker] Error in bundling request ${id}:`, error);
    
    // Handle errors
    self.postMessage({
      id,
      success: false,
      error: error.message || String(error)
    });
  }
};

// Bundling function (logic from original esbuild.js)
async function bundleFile(path, { ...options } = {}) {
  console.log(`[esbuild-worker] Starting bundle for ${path.href}`);
  
  try {
    const IMPORT_URL = new URL(path.href);
    IMPORT_URL.pathname = '';
    IMPORT_URL.search = '';

    const uuid = crypto.randomUUID();
    path.search = new URLSearchParams({ v: crypto.randomUUID() }).toString();

    // Define Import Map;
    const imports = { ...options?.denoConfig?.imports };
    const importMap = replaceTemplate(JSON.stringify({ imports: { ...imports, ...options?.denoConfig?.imports } }), { ...options, IMPORT_URL: IMPORT_URL.href })
    const importMapURL = `data:application/json,${importMap}`;
    
    // Define Deno Loader Plugins;
    const [denoResolver, denoLoader] = denoPlugins({ importMapURL });
    const config = {
      plugins: [
        denoResolver,
        denoLoader,
      ],
      bundle: true,
      format: "esm",
      write: false,
      minifyWhitespace: true,
      minifyIdentifiers: false,
      minifySyntax: true,
      jsx: "transform",
      platform: "browser",
    };

    if (options?.shared?.some(s => s === 'none')) {
      config.external = [];
    } else {
      config.external = ['react', 'react-dom/client', ...(options.shared || [])]
    }

    config.entryPoints = [path.href];

    console.log(`[esbuild-worker] Creating esbuild context with entrypoint: ${path.href}`);
    
    let ctx = await context(config);
    console.log(`[esbuild-worker] Starting esbuild rebuild`);
    const result = await ctx.rebuild();
    console.log(`[esbuild-worker] Bundling complete, output size: ${result?.outputFiles?.[0]?.text?.length || 0} bytes`);
    ctx.dispose();

    ctx = null;

    return result?.outputFiles?.[0]?.text;
  } catch (error) {
    console.error(`[esbuild-worker] Error during bundling:`, error);
    throw error;
  }
} 