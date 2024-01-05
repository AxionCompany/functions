// worker.js
import ModuleExecution from "./module-execution.ts";

// let fs;
// try {
//   const { createFsFromVolume, Volume } = await import("npm:memfs");
//   const vol = new Volume();
//   fs = createFsFromVolume(vol);
// } catch (err) {
//   console.log(err);
// }

self.onmessage = async (e) => {
  const { __requestId__ } = e.data;
  try {
    const response = createResponseCallback(__requestId__);
    const moduleExecutor = ModuleExecution();
    const chunk = await moduleExecutor(e.data, response, self);
    self.postMessage({ chunk, __requestId__, __done__: true });
  } catch (err) {
    console.log(err);
    self.postMessage({ __error__: true, ...err, __requestId__ });
  }
};

function createResponseCallback(__requestId__) {
  return {
    send: (chunk) => postMessage({ __requestId__, chunk, __done__: true }),
    redirect: (url) =>
      postMessage({ __requestId__, redirect: url, __done__: true }),
    stream: (chunk) => postMessage({ __requestId__, chunk }),
    status: (code) => postMessage({ __requestId__, status: code }),
    statusText: (text) => postMessage({ __requestId__, statusText: text }),
    options: (options) => postMessage({ __requestId__, options }),
    headers: (headers) => postMessage({ __requestId__, headers }),
  };
}
