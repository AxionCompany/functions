import { readFile } from "node:fs/promises";

export default ({ config }: any) => async ({ pathname }: any) => {
  let [loaderName, loaderType, ...rest] = pathname
    .split("/")
    .filter((p: any) => p);

  // read sources.json file from root of project

  // replace the following with a node.js compatible version
  // const sources = await Deno.readTextFile(`${config.functionsDir}/sources.json`)
  //   .then((res) => JSON.parse(res))
  //   .catch((err) => {
  //     return [];
  //   });

  const sources = await readFile(`${config.functionsDir}/sources.json`)
    .then((res) => JSON.parse(res.toString()))
    .catch((err) => {
      return [];
    });


  const source: any = sources.find((src: any) => (
    src.name === loaderName && src.type === loaderType
  ));

  let params: any = {};

  if (!source) {
    loaderType = config.loaderType || "local";
    params = {
      "functionsDir": config.functionsDir || "functions",
      "dirEntrypoint": config.dirEntrypoint || "main",
      ...config,
    };
  } else {
    pathname = `/${rest.join("/")}`;
    params = source.config;
  }

  return { loaderType, config: params, pathname };
};
