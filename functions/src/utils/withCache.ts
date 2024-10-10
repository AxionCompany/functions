import { get, set, } from "https://deno.land/x/kv_toolbox/blob.ts";

const connections = new Map<string, any>();

let warningIssued = false

const createDirIfNotExists = async (path: string) => {

    try {
        await Deno.mkdir(path, { recursive: true });
        return true;
    } catch (e) { console.log('Error on createDirIfNotExists', e) }
}


const Cache = async (projectId: string, prefix = '') => {

    let kv;
    // check if connection already exists
    if (connections.has(projectId)) {
        kv = connections.get(projectId);
    } else {
        if (!(typeof Deno.openKv === 'function')) {
            if (!warningIssued) {
                console.warn('Deno Kv not available in namespace... Bypassing cache usage. If you want to enable cache, run with --unstable-kv in Deno versions prior to 2.0.')
                warningIssued = true;
            }
            return (cb: Function, config: any, ...params: any[]) => cb(...params);
        }

        await createDirIfNotExists([prefix, 'cache'].filter(Boolean).join('/'));
        kv = await Deno.openKv([prefix, 'cache', 'cache.db'].filter(Boolean).join('/'));
        connections.set(projectId, kv);
    }

    const getCache = async (keys: string[]) => {
        const cachedData: any = await get(kv, ['cache', ...keys])
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

        return null;
    }

    const setCache = async (keys: string[], data: any, options: any) => {
        let strData = data;
        if (typeof strData !== 'string') {
            strData = JSON.stringify(strData || { error: "No data" });
        };

        set(kv, ['cache', ...keys], new TextEncoder().encode(strData), { expireIn: options?.cachettl });
    }

    return async (cb: Function, config: { bustCache: boolean | undefined, useCache: boolean | undefined, keys: string[], cachettl: number | undefined }, ...params: any[]) => {

        config.useCache = config.useCache !== false;
        config.cachettl = config.cachettl || 1000 * 60 * 10; // 10 minutes

        try {
            if (config.useCache && !config.bustCache) {
                const cachedData = await getCache(config.keys);
                if (typeof cachedData !== 'undefined') return cachedData;
            }
            const data = await cb(...params);
            if (config.useCache) {
                setCache(config.keys, data, config);
            }
            return data;
        } catch (e) {
            console.log('ERROR', e)
        }
    }
}

export default Cache


