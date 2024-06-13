export default ({ validateAuth, publicPaths, privatePaths }: any) => {

  publicPaths = publicPaths || [];
  privatePaths = privatePaths || [];

  return async (req: any) => {
    let error;
    try {
      // Check if the request is for public path
      const publicPathMatch = matchPaths(new URL(req.url), publicPaths);
      // Check if the request is for private path
      const privatePathMatch = matchPaths(new URL(req.url), privatePaths);
      // If the request url matches any public path AND does not matches any privatePath, return empty object
      if (publicPathMatch && !privatePathMatch) {
        return {}
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

const matchPaths = (url: URL, paths: string[]) => {
  for (const path of paths) {
    const _path = new URLPattern({ pathname: path });
    const _match = _path.exec(url);
    const pathData = { params: _match?.pathname?.groups };
    if (pathData?.params) {
      return pathData;
    }
  }
  return null;
}
