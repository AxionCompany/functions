export default async (adapters: any) => {
  let { features, middlewares, env } = adapters;

  console.log("Loading local adapters...");
  const LocalAdapters: any = await import("../adapters.ts")
    .then((res) => res.default)
    .catch((err) => console.log("Error loading local adapters", err));

  adapters = LocalAdapters ? LocalAdapters(adapters) : adapters;
  console.log("Local adapters loaded.");

  return async (req: Request) => {
    let ctx: any = {};

    // Adding Middlewares
    try {
      for (const key in middlewares) {
        const middleware = middlewares[key];
        const addedContext = await (await middleware)(req);
        ctx = { ...ctx, ...addedContext };
      }
    } catch (err) {
      return err;
    }

    try {
      const url: URL = new URL(req.url);
      console.log(`Loading file ${url.href}`);
      const { pathname } = url;

      const { content, redirect } = await (await features.loadFile(adapters))({
        pathname,
        ...ctx,
      });

      if (redirect) {
        url.pathname = redirect;
        console.log("Redirecting...");
        if (ctx?.user?.username) url.username = ctx.user.username;
        if (ctx?.user?.password) url.password = ctx.user.password;
        if (env?.SYS_ENV === "production") url.protocol = "https";
      }

      if (redirect) return Response.redirect(url.href, 307);

      return new Response(content, {
        headers: { "content-type": ("text/plain") },
      });
    } catch (err) {
      console.log(err);
      return new Response(err.message, {
        status: 404,
        statusText: "Not Found",
        headers: {
          "content-type": ("text/plain"),
        },
      });
    }
  };
};
