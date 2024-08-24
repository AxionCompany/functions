const worker = new Worker(import.meta.resolve("./functions/src/isolate/adapters/isolate.ts"), {
    type: "module",
    name: "isolate",
    deno: {
        permissions: {
            read: false,
            write: false,
            net: true,
            run: false,
            env: false,
            hrtime: false,
            ffi: false,
        }
    }
});


worker.postMessage({
    port: 3000,
    config: {}
});
