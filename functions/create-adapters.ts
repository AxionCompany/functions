// get ./adapters content, and get modules dynamically based on it
import { importModule } from "https://esm.sh/gh/vfssantos/deno-dynamic-import/mod.ts";

interface Module {
  path: string;
  config: any;
}

interface Modules {
  [key: string]: Module;
}

interface AdaptersConfig {
  [key: string]: Modules;
}

interface Adapters {
  [key: string]: any;
}

export default (initialConfig: Adapters) => async (
  adaptersConfig: AdaptersConfig,
) => {
  const { env, ...adapters } = initialConfig;
  for (const adapterKey in adaptersConfig) {
    const adapterConfig = adaptersConfig[adapterKey];
    for (const connectorKey in adapterConfig) {
      const connector = adapterConfig[connectorKey];
      const { path, config } = connector;
      const mod = await importModule(path);
      adapters[adapterKey][connectorKey] = mod?.default({
        adapters: _adapters,
        config: { env, ...config },
      });
    }
  }

  return adapters;
};
