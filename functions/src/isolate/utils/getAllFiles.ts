import getFile from './getFile.ts';

const getAllFiles = async ({ url, name, extensions, returnProp, ...rest }: any) => {

    const urlData = new URL(url);
    const possibleFileUrls: string[] = []
    urlData.pathname.split('/')
        .map((_, i, arr) => {
            const urlParts = arr.slice(0, i + 1)
            urlParts.push(name);
            const newUrl = new URL(url);
            newUrl.pathname = urlParts.join('/');
            newUrl.search = urlData.search;
            return newUrl.href

        })
        .forEach((url) => possibleFileUrls.push(url));

    const files = (
        await Promise.all(
            possibleFileUrls.map((url) =>
                getFile(url, { ext: extensions, fileName: name }, returnProp)
                    .then(res => res).catch(_ => null)
            ))
    ).filter(Boolean);

    return files;

}

export default getAllFiles;