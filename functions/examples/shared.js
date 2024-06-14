
const { default: daisyUi } = await importAxion(
    "modules/features/daisyUI",
)
// const Crud = await importAxion(
//     "modules/features/crud",
// )


export default (modules) => {

    const postCssConfig = daisyUi({ themes: ['emerald'] });

    // const models = Crud({
    //     type: 'mongodb', // only option for now is mongodb
    //     url: '...',
    //     dbName:'homolog',
    //     schemas:{},
    //   });
    
    return { ...modules, postCssConfig }

}