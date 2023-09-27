// import * as esbuild from "https://deno.land/x/esbuild@v0.17.19/mod.js";
// Import the WASM build on platforms where running subprocesses is not
// permitted, such as Deno Deploy, or when running without `--allow-run`.
import * as esbuild from "https://deno.land/x/esbuild@v0.17.19/wasm.js";
import { denoPlugins } from "https://deno.land/x/esbuild_deno_loader@0.8.1/mod.ts";
// import { wasmLoader } from "https://esm.sh/esbuild-plugin-wasm";
// import watPlugin from 'https://esm.sh/gh/vfssantos/esbuild-plugin-wat/index.js';
// import { polyfillNodeForDeno } from "https://esm.sh/esbuild-plugin-polyfill-node";

// import watPlugin from "https://esm.sh/gh/vfssantos/esbuild-plugin-wat/index.js"
import parseCode from "./esm-code-parser.ts";

async function createHash(message:string) {
  const data = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}


let esbuildInitialized = false;

const DENO_USER_AGENT =
  /^Deno\/(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:-(?<prerelease>(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+(?<buildmetadata>[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
const isDeno = DENO_USER_AGENT.test(navigator.userAgent);
const isDenoCLI = isDeno && !!Deno?.run;

const DynamicImport = ({ type, language, useWorker }: any) =>
  async function dynamicImport(content: string) {
    try {
      // if (content.startsWith("node:")) {
      // return await import(content);
      // } else {
      throw new Error("Not using regular import");
      // }
    } catch (err) {
      console.log(
        `Error trying to import ${content} with regular import... Using dynamic instead.`,
        err.message,
        err.stack,
      );

        
      let filePath;
  
      if (type === "file") {
        // const urlObj = new URL(content);
        // filePath = urlObj.href;
        filePath = content;
      } else {
        filePath = `data:text/${language || "tsx"};base64,${btoa(content)}`;
      }

      // Step 1: Create a unique cache key
      const cacheKey = createCacheKey(filePath);

      const kv = await Deno.openKv();

      // Step 2: Check cache before compilation
      const moduleData  = await kv.get(['modules', cacheKey]);
      let moduleCode:any = moduleData?.value;
      

      if (!moduleCode){

        console.log(cacheKey, 'Module not found in cache, compiling module...')

        // Step 3: Proceed to Compile module if not cached
  
        if (!esbuildInitialized) {
          esbuildInitialized = true;
          esbuild.initialize({ worker: useWorker || false });
        }
  
        const [denoResolver, denoLoader] = denoPlugins({ loader: "portable" });
  
        const config: any = {
          plugins: [
            denoResolver,
            // polyfillNodeForDeno({ globals:false, polyfills: {"fs": true , "crypto": true} }),
            // watPlugin(),
            // wasmLoader(),
            denoLoader,
          ],
          bundle: true,
          format: "esm",
          write: false,
        };
  
        console.log("Compiling file: ", filePath);
  
        config.entryPoints = [filePath];
  
        const result = await esbuild.build(config);
  
        moduleCode = result.outputFiles![0].text;

        kv.set(["modules", cacheKey], moduleCode);
      } else{
        console.log(cacheKey, 'Module found in cache, using cached module...')
      }

      const parsedCode = parseCode(
        moduleCode,
      );

      const _export: any = {};
      const dependencies: any = {};

      parsedCode.exports.forEach((item: any) => {
        _export[item.exportedName] = item.localName;
      });

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

      await Promise.all(dependencyPromises);

      const AsyncFunction = async function () {}.constructor;

      const mod = await AsyncFunction(
        ...Object.keys(dependencies),
        fn(parsedCode.code, _export, filePath),
      )(...Object.values(dependencies));

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

      isDenoCLI &&
        esbuild.stop();

      return sealedExports;
    }
  };

const createCacheKey = (path: string) => {
  if (path.startsWith("data:") && path.includes("base64,")) {
    const hash = createHash("sha256");
    hash.update(path);
    return hash.toString();
  } else {
    return path;
  }
};

const fn = (code: string, exports: any, filePath: string) => `
  try{

    let logs='';
    let oldLog = console.log;
  
    console.log = (...args)=> {
      logs = logs + args?.map(i=>JSON.stringify(i))?.join('\\n')+ '\\n';
      // oldLog(...args);
    };
  
    ${
  code.replaceAll(
    "import.meta",
    `{ main: false, url: '${filePath}', resolve(specifier) { return new URL(specifier, this.url).href } }`,
  )
}

    logs = logs.slice(0, -1);

    console.log = oldLog;
  
    return {...${
  JSON.stringify(exports || {})
    // remove quotes from values
    .replace(/"([^(")"]+)":/g, "$1:")
    // remove quotes from keys
    .replace(/"([^(")"]+)"/g, "$1")
},logs };
  } catch(err){
    console.log(err)
    return { error: err.message };
  }

  `;

// dynamicImport(
//   `http://TESTE:123456@localhost:8000/features/rates/search?v=${
//     new Date().getTime()
//   }`,
// ).then(async (mod: { default: Function }) => {
//   const result = await mod.default();
//   console.log(result)
// }).catch(console.log);

export default DynamicImport;
