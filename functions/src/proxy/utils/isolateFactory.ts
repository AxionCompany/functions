
import runOptions from "./runOptions.ts";

// Subprocess isolate creation
async function createSubprocessIsolate({ isolateId, projectId, reload, modules, port, isJSX, env, ...config }: any) {
    projectId = projectId || isolateId;

    const projectPath = `${Deno.cwd()}/data/${projectId}`;

    console.log('RUN OPTIONS for subprocess', projectId, 'isolate id', isolateId,'\n\n', ...runOptions({ reload, ...config.permissions }, { config: { projectId, projectPath, ...config }, modules, variables: env }))

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
        //To maintain behavior, set it to empty string, if not set in ENV, and set permission for "NO_COLOR" ENV variable
        Deno.env.set("NO_COLOR", env.NO_COLOR || "")
        config.permissions = {
            ...config.permissions,
            "allow-env": typeof config?.permissions?.["allow-env"] === 'boolean'
                ? config?.permissions?.["allow-env"]
                    ? true
                    : ["NO_COLOR"]
                : [...(config?.permissions?.["allow-env"] || []), "NO_COLOR"]

        }
    }

    const runOptionsObj = !config?.permissions?.['allow-all']
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
        console.log('starting subprocess isolate', config.isolateId);
        return createSubprocessIsolate(config);
    } else {
        console.log('starting web worker isolate', config.isolateId);
        return createWebWorkerIsolate(config);
    }
}
