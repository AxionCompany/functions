// worker.js
import ModuleExecution from "./module-execution.tsx";
import responseCallback from "../../../utils/responseCallback.ts";

// Flag to check if overrides have been applied
let overridesApplied = false;

const checkOrCreateDir = async (path) => {
  try {
    await Deno.stat(path);
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      await Deno.mkdir(path, { recursive: true });
    }
  }
};

const denoOverrides = {
  "openKv": ({ currentUrl, originalModule }) => async (data) => {
    const basePath = new URL(currentUrl).pathname.split("/").filter(Boolean)[0];
    await checkOrCreateDir(`./${basePath}/${data ? data : "data"}`);
    return originalModule(basePath);
  },
};

self.onmessage = async (e) => {
  const { __requestId__, currentUrl } = e.data;
  const response = responseCallback(__requestId__, postMessage);
  try {
    // Apply overrides only once
    if (!overridesApplied) {
      Object.keys(self.Deno).forEach((key) => {
        const originalModule = self.Deno[key];
        if (denoOverrides[key]) {
          self.Deno[key] = denoOverrides[key]({
            currentUrl,
            originalModule,
          });
        }
      });
      overridesApplied = true; // Set the flag to true after applying overrides
    }
    self.currentUrl = currentUrl;
    const moduleExecutor = ModuleExecution();
    const chunk = await moduleExecutor(e.data, response, self);
    response.send(chunk);
  } catch (err) {
    response.error(err);
  }
};
