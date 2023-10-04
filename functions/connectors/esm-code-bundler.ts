import * as esbuild from "https://deno.land/x/esbuild/wasm.js";
import { denoPlugins } from "https://deno.land/x/esbuild_deno_loader/mod.ts";
import { get, remove, set } from "https://deno.land/x/kv_toolbox/blob.ts";
import { h, Fragment } from "https://esm.sh/preact";
import parseCode from "./esm-code-parser.ts";

async function createHash(path: string) {
  const pathUint8 = new TextEncoder().encode(path); // encode as (utf-8) Uint8Array
  const hashBuffer = await crypto.subtle.digest("SHA-256", pathUint8); // hash the message
  const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join(
    "",
  ); // convert bytes to hex string

  return hashHex;
}

let esbuildInitialized = false;

const DENO_USER_AGENT =
  /^Deno\/(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:-(?<prerelease>(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+(?<buildmetadata>[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
const isDeno = DENO_USER_AGENT.test(navigator.userAgent);
const isDenoCLI = isDeno && !!Deno?.run;

const DynamicImport = ({ type, language, useWorker, cacheExpiration }: any) =>
  async function dynamicImport(content: string) {
    try {
      return await import(content);
    } catch (err) {
      let filePath;

      if (type === "file") {
        filePath = content;
      } else {
        filePath = `data:text/${language || "tsx"};base64,${btoa(content)}`;
      }

      // Step 1: Create a unique cache key
      const cacheKey = await createCacheKey(filePath);

      console.log(
        `Error trying to import ${cacheKey} with regular import... Using dynamic instead.`,
      );

      const kv = await Deno.openKv();

      // await remove(kv, ["c3a556b7edd3be748d4335a02dc1510f9a6eb2535bf8a5a5412149e164005b0f"]);

      const startFetchCache = new Date().getTime();

      // Step 2: Check cache before compilation
      const moduleData = await get(kv, [cacheKey]);

      let module: any;

      // Decode Uint8Array to string
      try {
        module = moduleData
          ? JSON.parse(new TextDecoder().decode(moduleData))
          : null;
      } catch (err) {
        remove(kv, [cacheKey]);
        module = null;
      }

      const endFetchCache = new Date().getTime();

      console.log(cacheKey, "Cache Checked", endFetchCache - startFetchCache, "ms")

      if (!module) {
        console.log(cacheKey, "Module not found in cache, compiling module...");
        const start = new Date().getTime();

        // Step 3: Proceed to Compile module if not cached
        if (!esbuildInitialized) {
          esbuildInitialized = true;
          esbuild.initialize({ worker: useWorker || false });
        }

        const [denoResolver, denoLoader] = denoPlugins({ loader: "portable" });

        const config: any = {
          plugins: [
            denoResolver,
            denoLoader,
          ],
          bundle: true,
          format: "esm",
          write: false,
          jsxFactory: "h",
          jsxFragment: "Fragment",
          jsx: "transform",
        };

        config.entryPoints = [filePath];

        const result = await esbuild.build(config);

        const moduleCode = result.outputFiles![0].text;

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
        // Step 4: Cache compiled module as Uint8Array
        module = {
          code: parsedCode.code,
          exports: _export,
          dependencies: dependencies,
        };

        const encodedModlue = new TextEncoder().encode(JSON.stringify(module));
        set(kv, [cacheKey], encodedModlue, {
          expireIn: (cacheExpiration || (1000 * 60 * 60 * 24 * 7)),
        });
        const endDate = new Date().getTime();
        console.log(cacheKey, "Module cached", endDate - start, "ms");
      } else {
        console.log(cacheKey, "Module found in cache, using cached module...");
      }

      const startMod = new Date().getTime();
      const { dependencies, exports, code } = module;

      dependencies["h"] = h;
      dependencies["Fragment"] = Fragment;

      const AsyncFunction = async function () {}.constructor;

      const mod = await AsyncFunction(
        ...Object.keys(dependencies),
        fn(code, exports, filePath),
      )(...Object.values(dependencies)).then((m: any) => m).catch(console.log);

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

      const endMod = new Date().getTime();

      console.log(cacheKey, "Module loaded", endMod - startMod, "ms");

      return sealedExports;
    }
  };

const createCacheKey = (path: string) => {
  if (path.startsWith("data:") && path.includes("base64,")) {
    return createHash(path);
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
},logs};
  } catch(err){
    console.log(err)
    return { error: err.message };
  }
`;

export default DynamicImport;
