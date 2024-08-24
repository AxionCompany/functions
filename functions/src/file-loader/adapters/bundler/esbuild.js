import { context } from "npm:esbuild";
import { denoPlugins } from "https://deno.land/x/esbuild_deno_loader/mod.ts";
import replaceTemplate from "../../../utils/template.ts";
import denoConfig from "../../../../../deno.json" with { type: "json" };

export default async (path, { ...options } = {}) => {

    // Define Import Map;
    const { imports } = denoConfig;
    const importMap = replaceTemplate(JSON.stringify({ imports: { ...imports, ...options?.denoConfig?.imports } }), options)
    const importMapURL = `data:application/json,${importMap}`;

    // Define Deno Loader Plugins;
    const [denoResolver, denoLoader] = denoPlugins({ importMapURL });
    const config = {
        plugins: [
            denoResolver,
            denoLoader,
            refreshServer
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
        config.external = ['react', 'react-dom', ...(options.shared || [])]
    }


    config.entryPoints = [path.href];


    let ctx = await context(config);
    const result = await ctx.rebuild();
    ctx.dispose();

    ctx = null;

    return result?.outputFiles?.[0]?.text;
};


const refreshServer = {
    name: "refresh-server",
    setup(build) {
        build.onEnd((result) => {
            if (build.initialOptions.incremental) {
                console.log(`refresh-server: Clearing Cache for ${build.initialOptions.entryPoints.join(", ")}...`);
                // Remove all items from the cache (this will force node to reload all of the built artifacts)
                Object.keys(require.cache).forEach(function (key) {
                    const resolvedPath = require.resolve(key);
                    if (resolvedPath.includes(build.initialOptions.outdir)) {
                        delete require.cache[key];
                    }
                });
            }
        });
    },
};