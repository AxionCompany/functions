
import daisyUi from "../../modules/features/css/daisyUI.js";

export default (modules) => {
    const postCssConfig = daisyUi({ themes: ['emerald'] });
    return { ...modules, postCssConfig }

}