export default (modules: any) => async (props: { pathname: string }) => {

  const { fileLoader, sourceMatch } = modules;

  
  const {config, pathname, loaderType} = await sourceMatch(props);
  
  console.log(`Loading file ${pathname} with loader ${loaderType}, config: ${JSON.stringify(config)}`)
  const file = await fileLoader[loaderType]({ config:config })(
    {
      pathname:pathname,
    },
  );

  return file;
};
