import JSCodeInterpreter from "../connectors/js-code-interpreter.ts";
// import PyCodeInterpreter from "../connectors/py-code-interpreter.ts";

export default (adapters) => {
  const codeInterpreter = JSCodeInterpreter(adapters);
  return async ({ code, props }) => {
    let res;
    const mod = await codeInterpreter({ code: code });
    if (mod.default) {
      res = await mod.default(props);
    } else {
      res = await mod.logs;
    }
    return res;
  };
};
