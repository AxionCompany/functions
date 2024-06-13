import tailwindcss from "npm:tailwindcss";
import postcssConfig from "./postcss.js";

export default ({ plugins, config }) => {

    const tailwindConfig = (html) => ({
        mode: "jit",
        content: [
            { raw: html, extension: "html" },
        ],
        plugins: plugins || [],
        ...config
    });

    return postcssConfig({
        plugins: { tailwindcss },
        configs: { tailwindcss: tailwindConfig }
    });

}