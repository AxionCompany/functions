// Start File-Loader
const fileloader = new Worker(new URL("./file-loader.ts", import.meta.url).href, { type: "module" });
// Start API
const api = new Worker(new URL("./api.ts", import.meta.url).href, { type: "module" });
