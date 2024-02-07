// worker.js
import ModuleExecution from "./module-execution.tsx";
import responseCallback from "../../../utils/responseCallback.ts";
import ReactDOMServer from "npm:react-dom/server";
import { bundle } from "https://deno.land/x/emit/mod.ts";
import React from "npm:react";
import tailwindcss from "npm:tailwindcss";
import postcss from "npm:postcss";

const getCss = async (tailwindConfig, html, css) => {
  const inputCss = css || `@tailwind base; @tailwind components; @tailwind utilities;`;
  const processor = postcss([tailwindcss({
    mode: "jit",
    content: [
      { raw: html, extension: "html" },
    ],
    ...tailwindConfig,
  })]);
  return await processor.process(inputCss, { from: undefined })
    .then((result) => {
      return result.css;
    });
};

self.onmessage = async (e) => {
  const { __requestId__, currentUrl } = e.data;
  const response = responseCallback(__requestId__, postMessage);

  try {
    self.currentUrl = currentUrl;
    self.React = React;
    const moduleExecutor = ModuleExecution({
      dependencies: {
        ReactDOMServer,
        React,
        getCss,
        bundle,
      },
    });
    const chunk = await moduleExecutor(e.data, response, self);
    response.send(chunk);
  } catch (err) {
    response.error(err);
  }
};
