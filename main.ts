
import getEnv from "./functions/src/utils/environmentVariables.ts";

const env = await getEnv();

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

    const fileLoaderUrl = env.FILE_LOADER_URL || "http://localhost:9000";

    const apiBaseUrl = env.DEFAULT_LOADER_TYPE === 'local' && !import.meta.url.startsWith('http') ? fileLoaderUrl : import.meta.url

    const api = new Worker(new URL("./api.ts", apiBaseUrl), { type: "module" });

    api.onmessage = (event) => {
        if (event?.data?.message?.status === 'ok') {
            return
        }
        console.log('API Restarting:', event.data.message);
        if (env.ENV !== 'production') {
            api.terminate();
            if (iter < maxRestarts) startApi(iter + 1);
        }
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