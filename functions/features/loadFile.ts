export default ({ connectors, env }: any) => async (props: { pathname: string }) => {
  
  const { fileLoader, sourceMatch } = connectors;

  const { config, pathname, loaderType } = await sourceMatch.default(props);

  console.log(`Loading file ${pathname} with loader ${loaderType}`);
  const { content, redirect } =
    (await fileLoader[loaderType]({ config: config })(
      {
        pathname: pathname,
      },
    )) || {};

  if (redirect) return { redirect };

  return { content };
};
