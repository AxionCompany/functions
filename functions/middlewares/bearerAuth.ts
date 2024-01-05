export default ({ validateAuth, publicPaths }: any) => {
  return async (req: any) => {
    let error;
    try {
      const pathName = new URL(req.url).pathname;
      if (publicPaths?.includes(pathName)) {
        return {};
      }
      const authorization = req.headers.get("authorization");
      if (authorization) {
        const match = authorization.match(/^Bearer\s+(.*)$/);
        if (match) {
          const access_token = match[1];
          const validatedUser = await validateAuth(access_token);
          return { user: validatedUser };
        }
      } else {
        const validatedUser = await validateAuth(null);
        return { user: validatedUser };
      }
    } catch (err) {
      console.log(err);
      error = err.message;
    }
    throw new Response(error || "401 Unauthorized", {
      status: 401,
      statusText: "Unauthorized",
      headers: {
        // "www-authenticate": `Basic realm="${realm}"`,
      },
    });
  };
};
//
