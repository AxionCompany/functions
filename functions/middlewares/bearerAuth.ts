export default ({ validateAuth }: any) => {
  return async (req: any) => {
    let error;
    try {
      const authorization = req.headers.get("authorization");
      if (authorization) {
        const match = authorization.match(/^Bearer\s+(.*)$/);
        if (match) {
          const access_token = match[1];
          const validatedUser = await validateAuth(access_token);
          return { user: validatedUser };
        }
      } else {
        return await validateAuth(null, null);
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
//