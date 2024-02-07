import { config } from "https://deno.land/x/dotenv@v3.2.2/mod.ts";

export default async ({ importUrl, dependencies }: any) => {
  const searchParams = importUrl.split("?")[1];
  const sharedModulesUrl = new URL(`./shared?${searchParams}`, new URL(importUrl).origin).href;

  let startTime = Date.now();

  const Dependencies =
    await import(sharedModulesUrl).then((mod) => mod.default) ||
    ((e: any) => e);

  dependencies = Dependencies({
    env: { ...Deno.env.toObject(), ...config() },
    ...dependencies,
  });

  try {
    startTime = Date.now();
    const { default: mod, _pathParams: pathParams, _matchedPath: matchedPath } =
      await import(importUrl);

    if (typeof mod !== "function") {
      throw { message: "Module Not Found", status: 404 };
    }

    return { mod, pathParams, matchedPath, dependencies };
  } catch (err) {
    console.log(err);
    throw err;
  }
};
