export default ({ env, handlers, ...adapters }: any) => {
  const handler = handlers[env.HANDLER_TYPE]({ ...adapters, env });
  const server = Deno.serve({ port: env.PORT || 8000 }, async (req: Request) => {
    return (await handler)(req);
  });
  return server.finished;
};
