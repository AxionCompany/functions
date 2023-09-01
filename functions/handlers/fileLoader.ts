export default async ({ env, ...adapters }: any) => {
  const { features, middlewares } = adapters;
  const { loadFile } = features;

  console.log("Loading local adapters...");
  const LocalAdapters: any = await import("../adapters.ts")
    .then((res) => res.default)
    .catch((err) => console.log("Error loading local adapters", err));

  adapters = LocalAdapters ? LocalAdapters(adapters) : adapters;
  console.log("Local adapters loaded.");

  return async (req: Request) => {
    let ctx = {};

    try {
      for (const key in middlewares) {
        const middleware = middlewares[key];
        const addedContext = await middleware(req);
        ctx = { ...ctx, ...addedContext };
      }
    } catch (err) {
      return err;
    }

    const pathname: string = new URL(req.url).pathname;

    const res = await loadFile(adapters)({ pathname, ...ctx });
    return new Response(res, {
      headers: { "content-type": "text/plain" },
    });
  };
};
