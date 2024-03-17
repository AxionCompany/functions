import { config } from "https://deno.land/x/dotenv@v3.2.2/mod.ts";

export default async ({ importUrl, dependencies }: any) => {

  const [baseUrl, searchParams] = importUrl.split("?");

  // const sharedModulesUrl = new URL(`./shared?${searchParams}`, new URL(importUrl).origin).href;
  const pathParts = new URL(baseUrl).pathname.split("/").filter(Boolean);

  let accPath = ".";

  const sharedModulesUrls = [`./shared?${searchParams}`];


  pathParts.forEach((part) => {
    if (!part) return
    accPath = `${accPath}/${part}`;
    sharedModulesUrls.push(`${accPath}/shared?${searchParams}`);
  });

  let startTime = Date.now();

  const dependenciesPromises = sharedModulesUrls.map((url) =>
    import(new URL(url, new URL(importUrl).origin).href)
      .then((mod) => {
        const { _matchPath } = mod;
        const isShared = ['shared.js', 'shared.ts', 'shared.jsx', 'shared.tsx']
          .some(i => _matchPath.includes(i))
        if (!isShared) return (e: any) => e
        return mod.default
      }).catch((_) => { })
  );

  const SharedModules = await Promise.all(dependenciesPromises);

  dependencies = SharedModules.reduce(
    (acc, Dependencies, index) => {
      if (!Dependencies) return acc
      return Dependencies({ ...acc })
    },
    { env: { ...Deno.env.toObject(), ...config(), ...dependencies } }
  );

  try {
    startTime = Date.now();
    const module = await import(importUrl).then(mod => mod).catch(console.log);
    if (typeof module === "string") throw { message: "Module Not Found", status: 404 };

    const { default: mod, GET, POST, PUT, DELETE, _pathParams: pathParams, _matchPath: matchedPath } = module;

    if (
      typeof mod !== "function" &&
      typeof GET !== "function" &&
      typeof POST !== "function" &&
      typeof PUT !== "function" &&
      typeof DELETE !== "function"
    ) {
      throw { message: "Imported Code should be an ESM Module.", status: 404 };
    }

    
    return {
      mod,
      GET,
      POST,
      PUT,
      DELETE,
      pathParams,
      matchedPath,
      dependencies
    };
  } catch (err) {
    console.log(err);
    throw err;
  }
};
