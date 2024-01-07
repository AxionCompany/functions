import moduleLoader from "./module-loader.ts";

const tryParseJSON = (str: any) => {
  try {
    return JSON.parse(str);
  } catch (err) {
    return str;
  }
};

export default (config: any) => {
  let { loader, dependencies } = config || {};
  if (!loader) loader = moduleLoader;
  return async (
    data: any,
    response: any = null,
    context: any = globalThis,
  ) => {
    try {
      const { url, params } = data;

      const startTime = Date.now();

      const { mod, pathParams, matchedPath, dependencies: deps } = await loader(
        { url, dependencies },
      );

      console.log("Total Load Time", Date.now() - startTime, "ms");

      let workerRes;
      // check if mod() is a function
      if (typeof (await mod(deps)) !== "function") {
        context.deps = deps;
        workerRes = await mod({
          matchedPath,
          ...pathParams,
          ...params,
        }, response);
      } else {
        const workerInstance = await mod(deps);
        workerRes = await workerInstance({
          matchedPath,
          ...pathParams,
          ...params,
        }, response);
      }
      // try parsing the response as JSON
      const chunk = tryParseJSON(workerRes);

      return chunk;
    } catch (err) {
      console.log(err);
      throw err;
    }
  };
};
