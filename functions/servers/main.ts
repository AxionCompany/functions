export default (
    { requestHandler, config }: any,
  ) => {
    const server = Deno.serve(
      { port: config?.PORT || 8000 },
      async (req: Request) => {
        return await requestHandler(req);
      },
    );
    return server.finished;
  };