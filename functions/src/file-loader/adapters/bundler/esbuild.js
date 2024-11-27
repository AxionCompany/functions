import { context } from "npm:esbuild";

import { denoPlugins } from "https://deno.land/x/esbuild_deno_loader/mod.ts";
import replaceTemplate from "../../../utils/template.ts";

export default async (path, { ...options } = {}) => {

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

    let ctx = await context(config);
    const result = await ctx.rebuild();
    ctx.dispose();

    ctx = null;

    return result?.outputFiles?.[0]?.text;
};

