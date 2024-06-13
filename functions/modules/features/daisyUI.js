import daisyui from "npm:daisyui";
import tailwindcssConfig from "./tailwindcss.js";

export default ({ themes, plugins, config }) => {
    plugins = plugins || [];  
    config = config || {};

    return tailwindcssConfig({
        plugins: [daisyui, ...plugins],
        config: {
            daisyui: { themes },
            ...config
        }
    })
};