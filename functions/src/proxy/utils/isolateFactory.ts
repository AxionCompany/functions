import runOptions from "./runOptions.ts";


// Subprocess isolate creation
async function createSubprocessIsolate({ isolateId, projectId, reload, modules, port, isJSX, env, ...config }: any) {
    projectId = projectId || isolateId;

    await modules.fs.ensureDir(`./data/${projectId}`);
    console.log('creating subprocess isolate', isolateId, ...runOptions({ reload, ...config.permissions }, { config, modules, variables: env }),);

    const command = new Deno.Command(Deno.execPath(), {
        env: { DENO_DIR: config.cacheDir || `./cache/.deno` },
        cwd: `./data/${projectId}`,
        args: [
            'run',
            ...runOptions({ reload, ...config.permissions }, { config, modules, variables: env }),
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

    const worker = new Worker(workerScript, {
        type: "module",
        deno: {
            permissions: runOptions({
                ...config.permissions,
                net: true,
                read: [`./data/${projectId}/`, `./data/${projectId}/cache/`, `./data/${projectId}/data/`],
                write: [`./data/${projectId}/`, `./data/${projectId}/cache/`, `./data/${projectId}/data/`]
            }, { config, modules, variables: env }),
        }
    });

    // Customize the communication protocol between main thread and worker here
    worker.postMessage({
        isolateId,
        projectId,
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
