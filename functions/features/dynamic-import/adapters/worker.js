// worker.js
import ModuleExecution from "./module-execution.tsx";
import responseCallback from "../../../utils/responseCallback.ts";

const denoOverrides = {
  "openKv": ({ currentUrl, originalModule }) => (data) => {
    return originalModule(
      `./${
        new URL(currentUrl)?.pathname?.split("/")?.filter(Boolean)?.[0]
      }${data ? "-" + data : ""}`,
    );
  },
};

self.onmessage = async (e) => {
  const { __requestId__, currentUrl } = e.data;
  const response = responseCallback(__requestId__, postMessage);
  try {
    Object.keys(self.Deno).forEach((key) => {
      const originalModule = self.Deno[key];
      if (denoOverrides[key]) {
        self.Deno[key] = denoOverrides[key]({
          currentUrl,
          originalModule,
        });
      }
    });
    self.currentUrl = currentUrl;
    const moduleExecutor = ModuleExecution();
    const chunk = await moduleExecutor(e.data, response, self);
    response.send(chunk);
  } catch (err) {
    response.error(err);
  }
};
