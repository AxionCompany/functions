
const githubFileloader = async (adapters: any) =>
  await import("./connectors/github-fileloader.js").then((m) => m.default(adapters));
const localFileloader = async (adapters: any) =>
  await import("./connectors/local-fileloader.js").then((m) => m.default(adapters));
const moduleLoader = async (adapters: any) =>
  await import("./connectors/module-loader.ts").then((m) => m.default(adapters));
const localSourcematch = async (adapters: any) =>
  await import("./connectors/local-sourcematch.ts").then((m) => m.default(adapters));
const functionExec = async (adapters: any) =>
  await import("./features/executeModule.ts").then((m) => m.default(adapters));
const loadFile = async (adapters: any) =>
  await import("./features/loadFile.ts").then((m) => m.default(adapters));
const apiHandler = async (adapters: any) =>
  await import("./handlers/rpc.ts").then((m) => m.default(adapters));
const fileLoaderHandler = async (adapters: any) =>
  await import("./handlers/fileLoader.ts").then((m) => m.default(adapters));
const basicAuth = async (adapters: any) =>
  await import("./middlewares/basicAuth.ts").then((m) => m.default(adapters));
const bearerAuth = async (adapters: any) =>
  await import("./middlewares/bearerAuth.ts").then((m) => m.default(adapters));
const denoServe = async (adapters: any) =>
  await import("./ports/denoServe.ts").then((m) => m.default(adapters));
const cloudfare = async (adapters: any) =>
  await import("./ports/cloudfareWorkers.ts").then((m) => m.default(adapters));


import { config } from "https://deno.land/x/dotenv/mod.ts";

export default (adapters: any = undefined) => {
  let dotEnv;

  try {
    dotEnv = config();
  } catch (err) {
    console.log(err);
    dotEnv = {};
  }

  const env = { ...dotEnv, ...Deno.env.toObject(), ...adapters?.env };

  const connectors = {
    sourceMatch: {
      default: localSourcematch({
        config: {
          dirEntrypoint: env.DIR_ENTRYPOINT,
          functionsDir: env.FUNCTIONS_DIR,
          loaderType: env.DEFAULT_LOADER_TYPE,
          owner: env.GIT_OWNER,
          repo: env.GIT_REPO,
          token: env.GIT_TOKEN,
        },
      }),
    },
    fileLoader: {
      github: githubFileloader,
      local: localFileloader,
    },
    moduleLoader: {
      default: moduleLoader({
        config: {
          username: env.AUTH_USERNAME,
          password: env.AUTH_PASSWORD,
          loaderUrl: env.FILE_LOADER_URL,
          functionsDir: env.FUNCTIONS_DIR,
        },
      }),
    },
  };

  const features = {
    functionExec,
    loadFile,
  };

  const middlewares = {
    basicAuth: basicAuth({
      validateAuth: (username: string, password: string) => {
        if (!env.AUHT_USERNAME && !env.AUTH_PASSWORD) return;
        if (
          (username === env.AUTH_USERNAME) && (password === env.AUTH_PASSWORD)
        ) {
          return { username, password };
        } else {
          throw new Error("Unauthorized");
        }
      },
    }),
    bearerAuth,
  };

  const handlers = {
    ["rpc"]: apiHandler,
    ["file-loader"]: (adapters: any) =>
      fileLoaderHandler({
        ...adapters,
        middlewares: { basicAuth: middlewares.basicAuth },
      }),
  };

  const ports = {
    ["deno-serve"]: denoServe,
    ["cloudfare-workers"]: cloudfare,
  };

  return {
    env,
    connectors,
    features,
    middlewares,
    handlers,
    ports,
  };
};
