export default ({ env, handlers, ...adapters }: any) => {
  const handler = handlers[env.HANDLER_TYPE]({ ...adapters, env });
  return Deno.serve({ port: env.PORT || 8000 }, async (req: Request) => {
    return (await handler)(req);
  });
};
