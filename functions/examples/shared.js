
const { default: daisyUi } = await importAxion(
    "modules/features/daisyUI",
)

export default (modules) => {

    const postCssConfig = daisyUi({ themes: ['emerald'] });

    return { ...modules, postCssConfig }

}