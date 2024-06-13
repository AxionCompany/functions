import tailwindcss from "npm:tailwindcss";
import daisyui from "npm:daisyui";

export default (modules) => {

    const tailwindConfig = (html) => ({
        mode: "jit",
        content: [
            { raw: html, extension: "html" },
        ],
        plugins: [daisyui],
        daisyui: { themes: ["emerald"] },
    });

    const postCssConfig = (html) => ({
        plugins: {
            tailwindcss: tailwindcss(tailwindConfig(html))
        }
    });

    return {
        ...modules,
        postCssConfig
    }

}