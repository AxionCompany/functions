import runOptions, { PermissionsConfig, IsolateConfig, RunOptionsContext } from "./runOptions.ts";

/**
 * Configuration for creating an isolate
 */
export interface IsolateFactoryConfig extends Omit<IsolateConfig, 'projectPath'> {
  isolateId: string;
  projectId: string;
  modules: any;
  port: number;
  isJSX: boolean;
  env: Record<string, string>;
  reload?: string[];
  bustCache?: boolean;
  functionsDir?: string;
  cacheDir?: string;
  permissions?: Partial<PermissionsConfig>;
  [key: string]: any;
}

/**
 * Result type for isolate creation
 */
export type IsolateInstance = Deno.ChildProcess | Worker;

/**
 * Creates a subprocess isolate
 * 
 * @param config - Configuration for the subprocess isolate
 * @returns A Deno child process
 */
async function createSubprocessIsolate(config: IsolateFactoryConfig): Promise<Deno.ChildProcess> {
  const { 
    isolateId, 
    projectId = isolateId, 
    reload, 
    modules, 
    port, 
    isJSX, 
    env, 
    ...restConfig 
  } = config;

  // Set up project path
  const projectPath = `${Deno.cwd()}/data/${projectId}`;

  // Parse import URL for authentication
  const importURL = new URL(env.IMPORT_URL);
  const { username, password, hostname, port: fileLoaderPort } = importURL;
  
  // Log subprocess creation
  console.log(`Creating subprocess isolate ${isolateId} on port ${port}`);
  
  // Prepare environment variables
  const envVars = { 
    DENO_DIR: restConfig.cacheDir || `./cache/.deno`, 
    DENO_AUTH_TOKENS: `${username}:${password}@${hostname}:${fileLoaderPort}` 
  };
  
  // Prepare run options
  const options = runOptions(
    { reload, ...restConfig.permissions }, 
    { 
      config: { 
        isolateType: 'subprocess',
        projectId, 
        projectPath, 
        ...restConfig 
      }, 
      modules, 
      variables: env 
    }
  ) as string[];
  
  // Determine isolate script based on JSX support
  const isolateScript = new URL(
    `../../isolate/adapters/${isJSX ? 'jsx-' : ''}isolate.ts`, 
    import.meta.url
  ).href;
  
  // Prepare isolate configuration
  const isolateConfig = JSON.stringify({
    isolateId,
    projectId,
    isJSX,
    ...restConfig,
    env,
  });
  
  // Create and spawn the subprocess
  const command = new Deno.Command(Deno.execPath(), {
    env: envVars,
    cwd: `./data/${projectId}`,
    args: [
      'run',
      ...options,
      isolateScript,
      `${port}`,
      isolateConfig,
    ].filter(Boolean),
  });

  return command.spawn();
}

/**
 * Creates a web worker isolate
 * 
 * @param config - Configuration for the web worker isolate
 * @returns A web worker
 */
function createWebWorkerIsolate(config: IsolateFactoryConfig): Worker {
  const { 
    isolateId, 
    projectId = isolateId, 
    modules, 
    port, 
    isJSX, 
    env, 
    ...restConfig 
  } = config;

  // Set up project path
  const projectPath = `${Deno.cwd()}/data/${projectId}`;
  
  // Log worker creation
  console.log(`Creating web worker isolate ${isolateId} on port ${port}`);
  
  // Determine isolate script based on JSX support
  const workerScript = new URL(
    `../../isolate/adapters/${isJSX ? 'jsx-' : ''}isolate.ts`, 
    import.meta.url
  ).href;

  // Handle special case for JSX and picocolors dependency
  let permissions = { ...restConfig.permissions };
  
  if (isJSX) {
    // picocolors dependency (css-related) requires access to "NO_COLOR" ENV 
    // or it needs to read directory. To maintain behavior, set it to empty string, 
    // if not set in ENV, and set permission for "NO_COLOR" ENV variable
    Deno.env.set("NO_COLOR", env.NO_COLOR || "");
    
    // Update permissions for NO_COLOR environment variable
    const currentEnvPerm = permissions["allow-env"];
    permissions = {
      ...permissions,
      "allow-env": typeof currentEnvPerm === 'boolean'
        ? currentEnvPerm ? true : ["NO_COLOR"]
        : [...(currentEnvPerm || []), "NO_COLOR"]
    };
  }

  // Prepare run options for worker
  const runOptionsObj = !restConfig?.permissions?.['allow-all']
    ? runOptions(
        permissions, 
        { 
          config: { 
            isolateType: 'worker',
            projectId, 
            projectPath, 
            ...restConfig 
          }, 
          modules, 
          variables: env 
        }
      )
    : undefined;

  // Create the worker
  const worker = new Worker(workerScript, {
    type: "module",
    deno: { permissions: runOptionsObj as Record<string, boolean | string[]> }
  });

  // Send configuration to the worker
  worker.postMessage({
    isolateId,
    projectId,
    projectPath,
    port,
    isJSX,
    ...restConfig,
    env,
  });

  return worker;
}

/**
 * Factory function to create an appropriate isolate based on configuration
 * 
 * @param config - Configuration for the isolate
 * @returns A subprocess or worker isolate
 */
export default async function isolateFactory(config: IsolateFactoryConfig): Promise<IsolateInstance> {
  try {
    if (config.isolateType === 'subprocess') {
      return await createSubprocessIsolate(config);
    } else {
      return createWebWorkerIsolate(config);
    }
  } catch (error) {
    console.error(`Error creating ${config.isolateType} isolate ${config.isolateId}:`, error);
    throw error;
  }
}
