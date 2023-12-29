// worker.js

let fs;
try {
  const { createFsFromVolume, Volume } = await import("npm:memfs");
  const vol = new Volume();
  fs = createFsFromVolume(vol);
} catch (err) {
  console.log(err);
}

self.onmessage = async (e) => {
  const { url, data, queryParams, dependencies, __requestId__ } = e.data;
  try {
    const { default: mod, _pathParams: pathParams, _matchedPath: matchedPath } = await import(
      url
    );

    if (typeof mod !== "function") {
      throw { message: "Module Not Found", status: 404 };
    }
    self.fs = fs;

    let workerRes;
    // check if mod() is a function
    if (typeof mod() !== "function") {
      workerRes = await mod({
        matchedPath,
        ...data,
        ...queryParams,
        ...pathParams,
      });
    } else {
      const workerInstance = mod(dependencies);
      workerRes = await workerInstance({
        matchedPath,
        ...data,
        ...queryParams,
        ...pathParams,
      });
    }
    // try parsing the response as JSON
    const res = tryParseJSON(workerRes);

    self.postMessage({ res, __requestId__ });
  } catch (err) {
    self.postMessage({ __error__: true, ...err, __requestId__ });
  }
};

const tryParseJSON = (str) => {
  try {
    return JSON.parse(str);
  } catch (err) {
    return str;
  }
};
