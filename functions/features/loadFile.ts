export default ({ connectors, redirect }: any) => async (props: { pathname: string }) => {
  const { fileLoader, sourceMatch, getMimeType } = connectors;

  const { config, pathname, loaderType } = await sourceMatch.default(props);

  console.log(`Loading file ${pathname} with loader ${loaderType}`);
  const { content, filename , redirect } =
    (await fileLoader[loaderType]({ config: config })(
      {
        pathname: pathname,
      },
    )) || {};

    if (redirect) return {redirect};

  const mimetype = await getMimeType({ filename });

  return { content, mimetype };
};
