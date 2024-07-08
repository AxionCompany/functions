import { build } from "npm:esbuild";
import { denoPlugins } from "https://deno.land/x/esbuild_deno_loader/mod.ts";

export default async (path, { ...options } = {}) => {

    const [denoResolver, denoLoader] = denoPlugins();

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
        external: ['react', 'react-dom', ...(options.shared || [])],
    };

    // path.searchParams.set('v', new Date().getTime());

    config.entryPoints = [path.href];

    const result = await build(config);

    const code = result?.outputFiles?.[0]?.text;

    return { code }

}
