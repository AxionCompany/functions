const startFileLoader = async (iter = 0) => {
    const fileLoader = new Worker(new URL("./file-loader.ts", import.meta.url).href, { type: "module" });
    fileLoader.onmessage = (event) => {
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
        api.terminate();
        console.log('API Restarting:', event.data.message);
        if (iter < maxRestarts) startApi(iter + 1);
    }
    api.onerror = (event) => {
        console.error('Error in API Worker:', event.message);
        if (iter < maxRestarts) startApi(iter + 1);
    };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

startFileLoader().then(async () => {
    await sleep(5000);
    startApi();
});
   

const maxRestarts = 100;