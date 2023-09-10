import loadFile from "../features/loadFile.ts";

export default async (adapters : any) => {
  let { features, middlewares } = adapters;
  features = { ...features, loadFile };

  console.log("Loading local adapters...");
  const LocalAdapters: any = await import("../adapters.ts")
    .then((res) => {
      console.log("Local adapters loaded.");
      return res.default;
    })
    .catch((err) => console.log("Error loading local adapters", err));

  adapters = LocalAdapters ? LocalAdapters(adapters) : adapters;
  console.log("Local adapters loaded.");

  return async (req: Request) => {
    let ctx: any = {};

    try {
      for (const key in middlewares) {
        const middleware = middlewares[key];
        const addedContext = await middleware(req);
        ctx = { ...ctx, ...addedContext };
      }
    } catch (err) {
      return err;
    }

    const url: URL = new URL(req.url);
    console.log(`Loading file ${url.href}`);
    const { pathname } = url;

    const { content, redirect } = await loadFile(adapters)({
      pathname,
      ...ctx,
    });

    if (redirect) url.pathname = redirect;
    if (ctx?.user?.username) url.username = ctx.user.username;
    if (ctx?.user?.password) url.password = ctx.user.password;

    if (redirect) return Response.redirect(url.href, 307);

    return new Response(content, {
      headers: { "content-type": ("text/plain") },
    });
  };
};
