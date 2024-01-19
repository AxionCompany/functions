
const fileloader = new Worker(new URL("./worker-file-loader.ts", import.meta.url).href, { type: "module" });
const api = new Worker(new URL("./worker-api.ts", import.meta.url).href, { type: "module" });
