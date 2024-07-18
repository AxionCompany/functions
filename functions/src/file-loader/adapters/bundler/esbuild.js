import { build } from "npm:esbuild";
import { denoPlugins } from "https://deno.land/x/esbuild_deno_loader/mod.ts";
import denoConfig from "../../../../../deno.json" with { type: "json" };

export default async (path, { ...options } = {}) => {
    const { imports } = denoConfig;

    const importMapURL = `data:application/json,${JSON.stringify({ imports: { ...imports, ...options?.denoConfig?.imports } })}`;

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
        external: ['react', 'react-dom', ...(options.shared || [])],
    };

    options.environment !== 'production' && path.searchParams.set('v', new Date().getTime());

    config.entryPoints = [path.href];

    const result = await build(config);

    const code = result?.outputFiles?.[0]?.text;

    return code;
};
