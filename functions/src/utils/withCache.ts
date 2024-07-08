import { get, set, } from "https://deno.land/x/kv_toolbox/blob.ts";

const createDirIfNotExists = async (path: string) => {
    try {
        await Deno.mkdir(path, { recursive: true });
        console.log('createdDir success', path)
        return true;
    } catch (e) { console.log('Error on createDirIfNotExists', e) }
}

await createDirIfNotExists('./cache/');
const kv = await Deno.openKv('./cache/db');

export default async (cb: Function, config: { useCache: boolean | undefined, keys: string[], cachettl: number | undefined }, ...params: any[]) => {

    config.useCache = config.useCache !== false;
    config.cachettl = config.cachettl || 1000 * 60 * 10; // 10 minutes

    try {
        if (config.useCache) {
            const cachedData: any = await get(kv, ['cache', ...config.keys])
            if (cachedData?.value !== null) {
                const cachedContent = new TextDecoder('utf-8').decode(cachedData.value);
                let parsedContent;
                try {
                    parsedContent = JSON.parse(cachedContent);
                    if (parsedContent?.error) return null;
                } catch (_) {
                    parsedContent = cachedContent;
                }
                return parsedContent;
            }
        }
        const data = await cb(...params);
        if (config.useCache) {
            const strData = JSON.stringify(data || { error: "No data" });
            set(kv, ['cache', ...config.keys], new TextEncoder().encode(strData), { expireIn: config.cachettl });
        }
        return data;
    } catch (e) {
        console.log('ERROR', e)
    }
}


