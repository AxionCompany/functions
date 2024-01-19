

export default async ({ importUrl, dependencies }: any) => {
  const sharedModulesUrl = new URL("./shared", new URL(importUrl).origin).href;

  let startTime = Date.now();

  const Dependencies =
    await import(sharedModulesUrl).then((mod) => mod.default) ||
    ((e: any) => e);

  console.log("Loaded Dependencies in", Date.now() - startTime, "ms");

  dependencies = Dependencies({
    env: Deno.env.toObject(),
    ...dependencies,
  });

  try {
    startTime = Date.now();
    const { default: mod, _pathParams: pathParams, _matchedPath: matchedPath } =
      await import(importUrl);
    console.log("Loaded Module in", Date.now() - startTime, "ms");

    if (typeof mod !== "function") {
      throw { message: "Module Not Found", status: 404 };
    }

    return { mod, pathParams, matchedPath, dependencies };
  } catch (err) {
    console.log(err);
    throw err;
  }
};
