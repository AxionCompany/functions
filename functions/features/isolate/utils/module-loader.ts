import { config } from "https://deno.land/x/dotenv@v3.2.2/mod.ts";
import getFile from "./getFile.ts";

export default async ({ importUrl, dependencies }: any) => {

  const [baseUrl, searchParams] = importUrl.split("?");

  // Build shared modules possible urls
  const possibleSharedUrls: string[] = [];
  new URL(baseUrl).pathname.split('/')
    .map((_, i, arr) => {
      return new URL(arr.slice(0, i + 1).join('/') + `/shared?${searchParams}`, new URL(importUrl).origin).href
    })
    .forEach((url) => possibleSharedUrls.push(url));

  const dependenciesUrl = (await Promise.all(possibleSharedUrls.map(async (url) => await getFile(url, ['js', 'jsx', 'ts', 'tsx'], 'matchPath').then(res => res).catch(_ => null))))
    .filter(Boolean);

  // Load shared modules
  const SharedModules = await Promise.all(
    dependenciesUrl.map((url) =>
      import(new URL(url, new URL(importUrl).origin).href)
        .then((mod) => mod.default)
    )
  );

  // Instantiate shared modules
  dependencies = SharedModules.reduce(
    (acc, Dependencies, index) => {
      if (!Dependencies) return acc
      return Dependencies({ ...acc })
    },
    { env: { ...Deno.env.toObject(), ...config(), ...dependencies } }
  );

  try {
    // Load target module
    const ESModule = await import(importUrl).then(mod => mod).catch(console.log);

    // Check if module is not found
    if (typeof ESModule === "string") throw { message: "Module Not Found", status: 404 };

    // Destructure module methods and exported properties
    const { default: mod, GET, POST, PUT, DELETE, _pathParams: pathParams, _matchPath: matchedPath, config } = ESModule;

    // Check if module is not a function. If not, return error
    if (
      typeof mod !== "function" &&
      typeof GET !== "function" &&
      typeof POST !== "function" &&
      typeof PUT !== "function" &&
      typeof DELETE !== "function"
    ) {
      throw { message: "Imported Code should be an ESM Module.", status: 404 };
    }

    // Return module and its dependencies
    return {
      mod,
      GET,
      POST,
      PUT,
      DELETE,
      pathParams,
      matchedPath,
      dependencies,
      config
    };
  } catch (err) {
    console.log(err);
    throw err;
  }
};
