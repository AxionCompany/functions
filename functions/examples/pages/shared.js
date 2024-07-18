
import daisyUi from "axion-modules/features/daisyUI.js";

export default (modules) => {
    const postCssConfig = daisyUi({ themes: ['emerald'] });
    return { ...modules, postCssConfig }

}