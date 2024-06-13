import getFile from './getFile.ts';
import postcss from "npm:postcss";

const processCss = async (config: any, html: string, importUrl: string) => {

    if (typeof config === 'function') {
        config = await config(html);
    } else if (typeof config !== 'object') {
        console.log('postCssConfig needs to be a function or an object')
        config = {};
    }

    const possibleCssUrls: string[] = []
    new URL(importUrl).pathname.split('/')
        .map((_, i, arr) => {
            return new URL(arr.slice(0, i + 1).join('/') + '/globals.css', new URL(importUrl).origin).href
        })
        .forEach((url) => possibleCssUrls.push(url));
    const css = (await Promise.all(possibleCssUrls.map(async (url) => await getFile(url, { ext: 'css', fileName: 'globals' }).then(res => res).catch(_ => '')))).join('\n');
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