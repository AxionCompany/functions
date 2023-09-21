// import DynamicImport from "./esm-code-bundler.ts";
// window.document = {};
// // // window.location={};

// const dynamicImport = DynamicImport({ type: "file", useWorker: false });
// const pyodideMod = await dynamicImport("https://cdn.jsdelivr.net/pyodide/v0.24.0/full/" );
// // const { loadPyodide }  = await import("https://unpkg.com/pyodide/pyodide.mjs" );

// // console.log(pyodideMod)
// const pyodide = await pyodideMod.loadPyodide();
// console.log(pyodide)

// // // const pyodide = await loadPyodide();
// const result = await pyodide.runPythonAsync("3+4");
// console.log("result:", result.toString());
// // window.document = {};
// // const {loadPyodide} = await import("https://www.unpkg.com/pyodide/pyodide.mjs");
// // const pyodide = await loadPyodide();
// // const result = await pyodide.runPythonAsync("3+4");
// // console.log("result:", result.toString()); // expected -> `result: 7`