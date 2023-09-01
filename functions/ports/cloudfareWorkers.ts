export default async ({ env, handlers, ...adapters }: any) => {
    const handler = await handlers[env.HANDLER_TYPE]({ ...adapters, env });
    return { fetch:  handler };
}