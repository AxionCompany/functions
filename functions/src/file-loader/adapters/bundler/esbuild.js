import { build } from "npm:esbuild";
import { denoPlugins } from "https://deno.land/x/esbuild_deno_loader/mod.ts";

export default async (path, { ...options } = {}) => {

    const [denoResolver, denoLoader] = denoPlugins();
    // inject importAxion as banner
    const metaUrl = import.meta.url.split('src')?.[0];

    //     const bannerJs = `
    // const importAxion = (path) => {
    //     return import("${metaUrl}"+path);
    // };
    // export { importAxion };
    //     `

    const config = {
        plugins: [
            denoResolver,
            denoLoader,
        ],
        bundle: true,
        format: "esm",
        write: false,
        minify: true,
        jsx: "transform",
        // inject:[`data:text/javascript,${encodeURIComponent(bannerJs)}`],
        external: ['react', 'react-dom', ...(options.shared || [])],
    };

    config.entryPoints = [path.href];

    const result = await build(config);

    // const code = replaceImportAxion(result?.outputFiles?.[0]?.text, `http://localhost:9002/`)
    const code = result?.outputFiles?.[0]?.text;

    return { code }

}

function replaceImportAxion(code, prefix) {
    // Regular expression to match importAxion(...path)
    const regex = /importAxion\(([^)]+)\)/g;

    // Replace the matched importAxion with import(prefix + path)
    const newCode = code.replace(regex, (match, p1) => {
        const quote = p1[0];
        p1=p1.slice(1,-1);
        return `import(${quote}${prefix}${p1}?bundle=true&v=${new Date().getTime()}${quote})`;
    });

    return newCode;
}