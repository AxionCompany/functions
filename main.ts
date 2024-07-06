
import { config } from "https://deno.land/x/dotenv/mod.ts";

let dotEnv;

try {
    dotEnv = config();
} catch (err) {
    console.log(err);
    dotEnv = {};
}

const env = { ...dotEnv, ...Deno.env.toObject() };
let fileLoaderStarted: any;

const startFileLoader = async (iter = 0) => {
    const fileLoader = new Worker(new URL("./file-loader.ts", import.meta.url).href, { type: "module" });
    fileLoader.onmessage = (event) => {
        if (event?.data?.message?.status === 'ok') {
            return fileLoaderStarted();
        }
        fileLoader.terminate();
        console.error('File Loader Restarting:', event.data.message);
        if (iter < maxRestarts) startFileLoader(iter + 1);
    }
    fileLoader.onerror = (event) => {
        console.error('Error in File Loader Worker:', event.message);
        if (iter < maxRestarts) startFileLoader(iter + 1);
    };
};

const startApi = async (iter = 0) => {
    const fileLoaderUrl = env.FILE_LOADER_URL
        || "http://localhost:9000";
    const api = new Worker(new URL("./api.ts", import.meta.url), { type: "module" });
    api.onmessage = (event) => {
        if (event?.data?.message?.status === 'ok') {
            return
        }
        api.terminate();
        console.log('API Restarting:', event.data.message);
        if (iter < maxRestarts) startApi(iter + 1);
    }
    api.onerror = (event) => {
        console.error('Error in API Worker:', event.message);
        if (iter < maxRestarts) startApi(iter + 1);
    };
};

const waitForFileLoader = new Promise((resolve) => {
    startFileLoader();
    fileLoaderStarted = resolve;
    return;
});

waitForFileLoader.then(() => startApi());

const maxRestarts = 100;