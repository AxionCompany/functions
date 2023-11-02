export default (adapters: any) =>
async (props: {
  v: any;
  pathname: string;
  params: any;
}) => {
  // get params
  const { params } = props;
  // get connectors
  const { connectors } = adapters || {};
  // get moduleLoader
  const { moduleLoader } = await connectors || {};
  // get module
  const mod = await (await moduleLoader.default)(props);
  // run module
  const res = await mod.default(adapters)(params);
  // return response
  return res;
};
