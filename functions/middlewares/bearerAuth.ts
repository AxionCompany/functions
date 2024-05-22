export default ({ validateAuth, publicPaths }: any) => {
  return async (req: any) => {
    let error;
    try {
      for (const path of publicPaths) {
        const publicPath = new URLPattern({ pathname: path });
        const _match = publicPath.exec(new URL(req.url))
        const pathData = { params: _match?.pathname?.groups };
        if (pathData?.params) {
          return {}
        }
      }
      const authorization = req.headers.get("authorization");
      if (authorization) {
        const match = authorization.match(/^Bearer\s+(.*)$/);
        if (match) {
          const access_token = match[1];
          const validatedUser = await validateAuth(access_token);
          return validatedUser
        }
      } else {
        const validatedUser = await validateAuth(null);
        return validatedUser;
      }
    } catch (err) {
      console.log(err);
      error = err.message;
    }
    throw { message: error, status: 401, statusText: "Unauthorized" }
  };
};
//
