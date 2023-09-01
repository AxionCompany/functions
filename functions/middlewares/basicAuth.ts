export default ({ validateAuth }: any) => {
  return async (req: any) => {
    let error;
    try {
      const authorization = req.headers.get("authorization");
      if (authorization) {
        const match = authorization.match(/^Basic\s+(.*)$/);
        if (match) {
          const [_username, _password] = atob(match[1]).split(":");
          const user = await validateAuth(_username, _password);
          return { user };
        }
      }
    } catch (err) {
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
