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
    const api = new Worker(new URL("./api.ts", import.meta.url).href, { type: "module" });
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