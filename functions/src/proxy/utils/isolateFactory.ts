// import runOptions from "./runOptions.ts";
import { ensureDir } from "https://deno.land/std/fs/ensure_dir.ts";


// // Subprocess isolate creation
// async function createSubprocessIsolate({ isolateId, projectId, reload, modules, port, isJSX, env, ...config }: any) {
//     projectId = projectId || isolateId;

//     await modules.fs.ensureDir(`./data/${projectId}`);
//     console.log('creating subprocess isolate', isolateId, ...runOptions({ reload, ...config.permissions }, { config, modules, variables: env }),);

//     const command = new Deno.Command(Deno.execPath(), {
//         env: { DENO_DIR: config.cacheDir || `./cache/.deno` },
//         cwd: `./data/${projectId}`,
//         args: [
//             'run',
//             ...runOptions({ reload, ...config.permissions }, { config, modules, variables: env }),
//             new URL(`../../isolate/adapters/${isJSX ? 'jsx-' : ''}isolate.ts`, import.meta.url).href,
//             `${port}`,
//             JSON.stringify({
//                 isolateId,
//                 projectId,
//                 isJSX,
//                 ...config,
//                 env,
//             }),
//         ].filter(Boolean),
//     });


//     const process = command.spawn();
//     return process;
// }


// // Web worker isolate creation
// function createWebWorkerIsolate({ isolateId, projectId, reload, modules, port, isJSX, env, ...config }: any) {
//     projectId = projectId || isolateId;

//     const workerScript = new URL(`../../isolate/adapters/${isJSX ? 'jsx-' : ''}isolate.ts`, import.meta.url).href;

//     const worker = new Worker(workerScript, {
//         type: "module",
//         deno: {
//             permissions: runOptions({
//                 ...config.permissions,
//                 net: true,
//                 read: [`./data/${projectId}/`, `./data/${projectId}/cache/`, `./data/${projectId}/data/`],
//                 write: [`./data/${projectId}/`, `./data/${projectId}/cache/`, `./data/${projectId}/data/`]
//             }, { config, modules, variables: env }),
//         }
//     });

//     // Customize the communication protocol between main thread and worker here
//     worker.postMessage({
//         isolateId,
//         projectId,
//         port,
//         isJSX,
//         ...config,
//         env,
//     });

//     return worker;
// }


// // Isolate factory
// export default (config: any) => {
//     if (config.isolateType === 'subprocess') {
//         console.log('starting subprocess isolate');
//         return createSubprocessIsolate(config);
//     } else {
//         console.log('starting web worker isolate');
//         return createWebWorkerIsolate(config);
//     }
// }



import runOptions from "./runOptions.ts";
import { denoLoaderPlugin } from "https://deno.land/x/esbuild_deno_loader@0.9.0/src/plugin_deno_loader.ts";


// Subprocess isolate creation
async function createSubprocessIsolate({ isolateId, projectId, reload, modules, port, isJSX, env, ...config }: any) {
    projectId = projectId || isolateId;

    const projectPath = `${Deno.cwd()}/data/${projectId}`;

    const command = new Deno.Command(Deno.execPath(), {
        env: { DENO_DIR: config.cacheDir || `./cache/.deno` },
        cwd: `./data/${projectId}`,
        args: [
            'run',
            ...runOptions({ reload, ...config.permissions }, { config: { projectId, projectPath, ...config }, modules, variables: env }),
            new URL(`../../isolate/adapters/${isJSX ? 'jsx-' : ''}isolate.ts`, import.meta.url).href,
            `${port}`,
            JSON.stringify({
                isolateId,
                projectId,
                isJSX,
                ...config,
                env,
            }),
        ].filter(Boolean),
    });


    const process = command.spawn();
    return process;
}


// Web worker isolate creation
function createWebWorkerIsolate({ isolateId, projectId, reload, modules, port, isJSX, env, ...config }: any) {
    projectId = projectId || isolateId;

    const workerScript = new URL(`../../isolate/adapters/${isJSX ? 'jsx-' : ''}isolate.ts`, import.meta.url).href;

    const projectPath = `${Deno.cwd()}/data/${projectId}`;

    if (isJSX) {
        // picocolors dependency (css-related) requires access to "NO_COLOR" ENV or it needs to read directory. 
        //To maintain behavior, set it to empty string, if not set in ENV
        Deno.env.set("NO_COLOR", env.NO_COLOR || "")
    }


    const runOptionsObj = !config.permissions['allow-all']
        ? runOptions({ ...config.permissions }, { config: { projectId, projectPath, ...config }, modules, variables: env })
        : undefined

    const worker = new Worker(workerScript, {
        type: "module",
        deno: { permissions: runOptionsObj }
    });

    // Customize the communication protocol between main thread and worker here
    worker.postMessage({
        isolateId,
        projectId,
        projectPath,
        port,
        isJSX,
        ...config,
        env,
    });

    return worker;
}


// Isolate factory
export default (config: any) => {
    if (config.isolateType === 'subprocess') {
        console.log('starting subprocess isolate');
        return createSubprocessIsolate(config);
    } else {
        console.log('starting web worker isolate');
        return createWebWorkerIsolate(config);
    }
}
