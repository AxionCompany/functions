
export default ({ plugins, configs }) => {

    const postCssConfig = (html) => {
        const postCssPlugins = {};
        for (const pluginName in plugins) {
            postCssPlugins[pluginName] = plugins[pluginName](configs[pluginName](html));
        }
        return {
            plugins: postCssPlugins
        };

    }
    return postCssConfig;
}