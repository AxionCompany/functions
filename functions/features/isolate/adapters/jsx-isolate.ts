import server from "../../../servers/main.ts";
import RequestHandler from "../../../handlers/main.ts";
import ModuleExecution from "../utils/module-execution.tsx";
import { bundle } from "https://deno.land/x/emit/mod.ts";
import ReactDOMServer from "npm:react-dom/server";
import React from "npm:react";
import tailwindcss from "npm:tailwindcss";
import postcss from "npm:postcss";
import * as acorn from "npm:acorn";

globalThis.React = React

const getCss = async (tailwindConfig: any, html: string, css: string) => {
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

// Flag to check if overrides have been applied
let overridesApplied = false;

const checkOrCreateDir = async (path: string) => {
    try {
        await Deno.stat(path);
    } catch (err) {
        if (err instanceof Deno.errors.NotFound) {
            await Deno.mkdir(path, { recursive: true });
        }
    }
};

const port: number = parseInt(Deno.args?.[0]) || 3000;

const denoOverrides: any = {
    "openKv": ({ currentUrl, originalModule, ...rest }: {
        currentUrl: string;
        originalModule: any;
    }) => async (data: any) => {
        try {
            const basePath = new URL(currentUrl).pathname.split("/").filter(Boolean)[0];
            const kvDir = `data/${basePath}`;
            await checkOrCreateDir(kvDir);
            return originalModule(kvDir + '/kv');
        } catch (err) {
            console.log('err in open Deno kv ', err)
            return originalModule(data)
        }
    },
};


const _config = {
    middlewares: {},
    pipes: {}, // default to no pipes
    handlers: {
        "/(.*)+": async ({ data }: any, response: any) => {
            if (Object.keys(data).length === 1) return
            const { currentUrl, method } = data;
            try {
                // Apply overrides only once
                if (!overridesApplied) {
                    Object.keys(self.Deno).forEach((key) => {
                        const originalModule = Deno[key];
                        if (denoOverrides[key]) {
                            Deno[key] = denoOverrides[key]({
                                currentUrl,
                                originalModule,
                            });
                        }
                    });
                    overridesApplied = true; // Set the flag to true after applying overrides
                }

                if (!data.importUrl) {
                    return response.send('ok');
                }

                const moduleExecutor = ModuleExecution({
                    currentUrl, method, dependencies: {
                        ReactDOMServer,
                        React,
                        getCss,
                        bundle,
                        findExportedVariables
                    },
                });
                const chunk = await moduleExecutor(data, response);
                return response.send(chunk);
            } catch (err) {
                response.error(err);
            }
        }
    },
    serializers: {},
    dependencies: {},
    config: {},
};

const { config, ...adapters }: any = _config

server({ port, requestHandler: RequestHandler(adapters), config });

// // Function to find the exported variables
const findExportedVariables = (code: string, names: string[] = ['default']) => {
    const ast = acorn.parse(code, { ecmaVersion: 2020, sourceType: "module" });
    const exportedVariables: Record<string, string | null> = {};
    for (const node of ast.body) {
        if (node.type === 'ExportNamedDeclaration') {
            for (const specifier of node.specifiers) {
                if (names.includes(specifier.exported.name)) {
                    exportedVariables[specifier.exported.name] = specifier.local.name;
                }
            }
        }
    }
    return exportedVariables;
}
