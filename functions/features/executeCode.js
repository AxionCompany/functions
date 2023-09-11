import JSCodeInterpreter from "../connectors/js-code-interpreter.ts";

export default (adapters) => {
  const codeInterpreter = JSCodeInterpreter(adapters);
  return async (props) => {
    const mod = await codeInterpreter({ code: props.code });
    const res = await mod.default(props);
    return res;
  };
};
