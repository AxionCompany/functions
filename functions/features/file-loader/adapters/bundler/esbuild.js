import * as esbuild from "npm:esbuild";
import { denoPlugins } from "https://deno.land/x/esbuild_deno_loader/mod.ts"

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
        minify: true,
        jsxFragment: "Fragment",
        jsx: "transform",
        external:['react','react-dom'],
    };

    config.entryPoints = [path.href];

    const result = await esbuild.build(config);

    return { code: result?.outputFiles?.[0]?.text }
}