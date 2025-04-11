import getEnv from "./functions/src/utils/environmentVariables.ts";
import { logDebug, logError, logInfo, logWarning, setLogConfig } from "./functions/src/utils/logger.ts";

const env = await getEnv();

// Configure logging based on environment
setLogConfig({
  debugLogs: env.DEBUG === 'true',
  errorLogs: true,
  infoLogs: env.INFO === 'true',
  warningLogs: true
});

let fileLoaderStarted: any;
const maxRestarts = 100;

const startFileLoader = async (iter = 0) => {
    logInfo("Starting File Loader Worker", iter > 0 ? `(attempt ${iter + 1})` : "");
    const fileLoader = new Worker(new URL("./file-loader.ts", import.meta.url).href, { type: "module" });
    
    fileLoader.onmessage = (event) => {
        logDebug("Received message from File Loader:", event?.data);
        if (event?.data?.message?.status === 'ok') {
            logInfo("File Loader started successfully");
            return fileLoaderStarted();
        }
        fileLoader.terminate();
        logError('File Loader Restarting:', event.data.message);
        if (iter < maxRestarts) startFileLoader(iter + 1);
    }
    
    fileLoader.onerror = (event) => {
        logError('Error in File Loader Worker:', event.message);
        if (iter < maxRestarts) startFileLoader(iter + 1);
    };
};

const startApi = async (iter = 0) => {
    const fileLoaderUrl = env.FILE_LOADER_URL || "http://localhost:9000";
    const apiBaseUrl = env.DEFAULT_LOADER_TYPE === 'local' && !import.meta.url.startsWith('http') ? fileLoaderUrl : import.meta.url;

    logInfo("Starting API Worker with base URL:", apiBaseUrl, iter > 0 ? `(attempt ${iter + 1})` : "");
    const api = new Worker(new URL("./api.ts", apiBaseUrl), { type: "module" });
    logInfo("API Worker started");

    api.onmessage = (event) => {
        logDebug("Received message from API:", event?.data);
        if (event?.data?.message?.status === 'ok') {
            logInfo("API started successfully");
            return;
        }
        logWarning('API Restarting:', event.data.message);
        if (env.ENV !== 'production') {
            api.terminate();
            if (iter < maxRestarts) startApi(iter + 1);
        }
    }
    
    api.onerror = (event) => {
        logError('Error in API Worker:', event.message);
        if (iter < maxRestarts) startApi(iter + 1);
    };
};

const waitForFileLoader = new Promise((resolve) => {
    logInfo("Initializing startup sequence");
    startFileLoader();
    fileLoaderStarted = resolve;
    return;
});

waitForFileLoader.then(() => {
    logInfo("File Loader ready, starting API");
    startApi();
});