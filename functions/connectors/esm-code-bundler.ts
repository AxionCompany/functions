// import * as esbuild from "https://deno.land/x/esbuild@v0.17.19/mod.js";
// Import the WASM build on platforms where running subprocesses is not
// permitted, such as Deno Deploy, or when running without `--allow-run`.
import * as esbuild from "https://deno.land/x/esbuild@v0.17.19/wasm.js";
import { denoPlugins } from "https://deno.land/x/esbuild_deno_loader@0.8.1/mod.ts";
import parseCode from "./esm-code-parser.ts";

let esbuildInitialized = false;

const DENO_USER_AGENT =
  /^Deno\/(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:-(?<prerelease>(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+(?<buildmetadata>[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
const isDeno = DENO_USER_AGENT.test(navigator.userAgent);
const isDenoCLI = isDeno && !!Deno?.run;

const DynamicImport = ({ type, useWorker }: any) =>
  async function dynamicImport(content: string) {
    try {
      // if (content.startsWith("node:")) {
      return await import(content);
      // } else {
      //   throw new Error("Not using regular import");
      // }
    } catch (err) {
      console.log(
        `Error trying to import ${content} with regular import... Using dynamic instead.`,
      );
      console.log('trace 1')

      if (!esbuildInitialized) {
        esbuildInitialized = true;
        esbuild.initialize({ worker: useWorker || false });
      }

      console.log('trace 2')

      const [denoResolver, denoLoader] = denoPlugins({ loader: "portable" });

      const config: any = {
        plugins: [
          denoResolver,
          denoLoader,
        ],
        bundle: true,
        format: "esm",
        write: false,
      };

      console.log('trace 3')

      let filePath;

      if (type === "file") {
        // const urlObj = new URL(content);
        // filePath = urlObj.href;
        filePath = content;
      } else {
        filePath = `data:text/javascript;base64,${btoa(content)}`;
      }

      console.log('trace 4')

      config.entryPoints = [filePath];

      const result = await esbuild.build(config);
      console.log('trace 5')

      const outputText = result.outputFiles![0].text;

      const parsedCode = parseCode(
        // stripShebang(
        outputText,
        // )
      );

      console.log('trace 6')

      const _export: any = {};
      const dependencies: any = {};

      parsedCode.exports.forEach((item: any) => {
        _export[item.exportedName] = item.localName;
      });

      console.log('trace 7')

      const dependencyPromises: any[] = [];

      parsedCode.imports.forEach((item: any) => {
        dependencyPromises.push(
          dynamicImport(`node:${item.source}`) // TODO: this is considering that only node: imports are are left unimported by esbuild
            .then((dep) => {
              item.specifiers?.forEach((i: any) => {
                dependencies[i.localName] = dep[i.importedName] || dep;
              });
            })
            .catch((err) => {
              console.log(
                `Not possible to load dependency "${item.source}":\n${err.message}`,
              );
            }),
        );
      });

      console.log('trace 8')

      await Promise.all(dependencyPromises);

      console.log('trace 9')

      const AsyncFunction = async function () {}.constructor;

      const mod = await AsyncFunction(
        ...Object.keys(dependencies),
        `${parsedCode.code};return ${
          JSON.stringify(_export)
            // remove quotes from values
            .replace(/"([^(")"]+)":/g, "$1:")
            // remove quotes from keys
            .replace(/"([^(")"]+)"/g, "$1")
        }`,
      )(...Object.values(dependencies));

      console.log('trace 10')

      const toStringTaggedExports = Object.assign({
        [Symbol.toStringTag]: "Module",
      }, mod);

      const sortedExports = Object.fromEntries(
        Object.keys(toStringTaggedExports)
          .sort()
          .map((key) => [key, toStringTaggedExports[key]]),
      );

      const prototypedExports = Object.assign(
        Object.create(null),
        sortedExports,
      );
      const sealedExports = Object.seal(prototypedExports);

      console.log('trace 11')

      isDenoCLI &&
        esbuild.stop();

      console.log('trace 12')

      return sealedExports;
    }
  };

// dynamicImport(
//   `http://TESTE:123456@localhost:8000/features/rates/search?v=${
//     new Date().getTime()
//   }`,
// ).then(async (mod: { default: Function }) => {
//   const result = await mod.default();
//   console.log(result)
// }).catch(console.log);

export default DynamicImport;
