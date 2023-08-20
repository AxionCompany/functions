export default (adapters: any) =>
async (props: {
  v: any;
  pathname: string;
  params: any;
  token: string | undefined;
}) => {
  const { params } = props;
  // get module
  const mod = await adapters['moduleLoader'](props);
  // run module
  const res = await mod.default(adapters)(params);
  // return response
  return res;
};
