// worker.js
import ModuleExecution from "./module-execution.tsx";
import responseCallback from "../../../utils/responseCallback.ts";

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
    const response = responseCallback(__requestId__, postMessage);
    const moduleExecutor = ModuleExecution();
    const chunk = await moduleExecutor(e.data, response, self);
    self.postMessage({ chunk, __requestId__, __done__: true });
  } catch (err) {
    console.log(err);
    self.postMessage({ __error__: true, ...err, __requestId__ });
  }
};
