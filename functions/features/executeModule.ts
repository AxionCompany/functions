export default ({ env, ...adapters }: any) => {
  // get connectors
  const { connectors } = adapters || {};
  // get moduleLoader
  const { moduleLoader } = connectors || {};
  return async (props: {
    v: any;
    pathname: string;
    params: any;
    token: string | undefined;
  }) => {
    // get params
    const { params } = props;
    // get module
    const mod = await moduleLoader.default(props);
    // run module
    const res = await mod.default(adapters)(params);
    // return response
    return res;
  };
};
