export default ({ connectors }: any) => async (props: { pathname: string }) => {
  const { fileLoader, sourceMatch } = connectors;

  const { config, pathname, loaderType } = await sourceMatch.default(props);

  console.log(`Loading file ${pathname} with loader ${loaderType}`);
  const file = await fileLoader[loaderType]({ config: config })(
    {
      pathname: pathname,
    },
  );

  return file;
};
