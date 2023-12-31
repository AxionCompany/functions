export default ({ connectors }: any) => async (props: { pathname: string }) => {
  const { fileLoader, sourceMatch } = connectors;

  const { config, pathname, loaderType } = await (await sourceMatch.default)(
    props,
  );

  console.log(`Loading file ${pathname} with loader ${loaderType}`);
  const { content, redirect } =
    await ((await fileLoader[loaderType]({ config: config }))(
      {
        pathname: pathname,
      },
    )) || {};

  if (redirect) return { redirect };

  return { content };
};
