import DynamicImport from "./esm-code-bundler.ts";

export default ({ config }: any) => {
  const dynamicImport = DynamicImport({ type: "code", useWorker: false });
  return async (props: {
    v?: any;
    code: string;
  }) => {
    // get props
    let { code } = props;
    const mod = await dynamicImport(code);
    // return module
    return mod;
  };
};
