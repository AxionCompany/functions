const getFile = async (url: string, ext: Array<string> | string | null = null, returnProp = 'content') => {
    const res = await fetch(url, { headers: { 'content-type': 'application/json' } });
    if (!res.ok) throw new Error(`Failed to fetch ${url}`);

    const data = await res.json();
    if (ext && typeof ext === 'string' && !data.matchPath?.split('.')?.pop()?.split('?')?.[0]?.includes(ext)) {
        throw new Error(`Matched file does not contain .${ext} extension`);
    }
    else if (ext && Array.isArray(ext) && !ext.includes(data.matchPath?.split('.')?.pop()?.split('?')?.[0])) {
        throw new Error(`Matched file does not contain one of the following extensions: ${ext.join(',')}`);
    }
    return data[returnProp];
}

export default getFile;