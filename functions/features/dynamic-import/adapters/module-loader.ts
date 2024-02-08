import { config } from "https://deno.land/x/dotenv@v3.2.2/mod.ts";

export default async ({ importUrl, dependencies }: any) => {
  const [baseUrl, searchParams] = importUrl.split("?");

  // const sharedModulesUrl = new URL(`./shared?${searchParams}`, new URL(importUrl).origin).href;
  const pathParts = new URL(baseUrl).pathname.split("/").filter(Boolean);

  let accPath = ".";

  const sharedModulesUrls = [`./shared?${searchParams}`];


  pathParts.forEach((part) => {
    accPath = `${accPath}/${part}`;
    sharedModulesUrls.push(`${accPath}/shared?${searchParams}`);
  });


  let startTime = Date.now();

  const dependenciesPromises = sharedModulesUrls.map((url) =>
    import(new URL(url, new URL(importUrl).origin).href).then((mod) => {
      const { _matchPath } = mod;
      const isShared = ['shared.js', 'shared.ts', 'shared.jsx', 'shared.tsx']
        .some(i => _matchPath.includes(i))
        console.log(url,_matchPath, isShared)
      if (!isShared) return (e: any) => e
      return mod.default
    }).catch(_ => (e: any) => e)
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
    const { default: mod, _pathParams: pathParams, _matchPath: matchedPath } =
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
