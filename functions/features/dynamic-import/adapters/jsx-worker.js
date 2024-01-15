// worker.js
import ModuleExecution from "./module-execution.tsx";
import responseCallback from "../../../utils/responseCallback.ts";
import ReactDOMServer from "npm:react-dom/server";
import React from "npm:react";
import { setup } from "npm:twind";
import { getStyleTag, shim, virtualSheet } from "npm:twind/shim/server";

const sheet = virtualSheet();
const twindSetup = (config) => setup({ sheet, ...config });

self.onmessage = async (e) => {
  const { __requestId__ } = e.data;
  try {
    self.React = React;
    const response = responseCallback(__requestId__, postMessage);
    const moduleExecutor = ModuleExecution({
      dependencies: {
        ReactDOMServer,
        React,
        twindSetup,
        sheet,
        getStyleTag,
        shim,
      },
    });
    const chunk = await moduleExecutor(e.data, response, self);
    self.postMessage({ chunk, __requestId__, __done__: true });
  } catch (err) {
    console.log(err);
    self.postMessage({ __error__: true, ...err, __requestId__ });
  }
};
