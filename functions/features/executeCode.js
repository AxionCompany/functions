import JSCodeInterpreter from "../connectors/js-code-interpreter.ts";

export default (adapters) => {
  const codeInterpreter = JSCodeInterpreter(adapters);
  return async (props) => {
    const res = await codeInterpreter({ code: props.code });
    return res;
  };
};
