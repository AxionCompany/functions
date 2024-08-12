import getAllFiles from './getAllFiles.ts';
import postcss from "postcss";

const processCss = async (config: any, html: string, importUrl: string) => {
    if (typeof config === 'function') {
        config = await config(html);
    } else if (typeof config !== 'object') {
        console.log('postCssConfig needs to be a function or an object')
        config = {};
    }

    const css = (await getAllFiles({ url: importUrl, name: 'globals', extensions: ['css'], returnProp: 'content' })).join('\n')

    const plugins: any = Object.entries(config.plugins).map(([_, plugin]) => plugin).filter(Boolean) || [];
    if (plugins?.length) {
        const processor = postcss(plugins);
        return await processor.process(css, { from: undefined })
            .then((result) => {
                return result.css;
            });
    }
    return '';
}

export default processCss