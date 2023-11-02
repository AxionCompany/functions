
import JSCodeInterpreter from "../connectors/js-code-interpreter.ts";
// import PyCodeInterpreter from "../connectors/py-code-interpreter.ts";
import render from "https://esm.sh/preact-render-to-string";

const htmlWrapper = (html) =>
  `<!DOCTYPE html><html><body>${html}</body></html>`;

export default (adapters) => {
  const codeInterpreter = JSCodeInterpreter(adapters);
  try {
    return async ({ code, props }) => {
      let res;
      const mod = await codeInterpreter({ code: code });
      if (mod.default) {
        // check if default is a function
        if (typeof mod.default !== "function") {
          res = await mod.default;
        } else {
          res = await mod.default(props);
        }
        if (res.type) {
          res = htmlWrapper(await render(res));
        }
      } else {
        res = await mod.logs;
      }
      return res;
    };
  } catch (err) {
    return err;
  }
};
