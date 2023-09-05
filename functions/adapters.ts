import githubFileloader from "./connectors/github-fileloader.js";
import localFileloader from "./connectors/local-fileloader.js";
import moduleLoader from "./connectors/module-loader.ts";
import localSourcematch from "./connectors/local-sourcematch.ts";
import functionExec from "./features/executeFunction.ts";
import loadFile from "./features/loadFile.ts";
import apiHandler from "./handlers/rpc.ts";
import fileLoaderHandler from "./handlers/fileLoader.ts";
import basicAuth from "./middlewares/basicAuth.ts";
import denoServe from "./ports/denoServe.ts";
import cloudfare from "./ports/cloudfareWorkers.ts";

import { config } from "https://deno.land/x/dotenv/mod.ts";

export default (adapters: any = undefined) => {
  const env = { ...Deno.env.toObject(), ...config() };

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
          username: env.USERNAME,
          password: env.PASSWORD,
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
        if (!env.USERNAME && !env.PASSWORD) return true;
        if ((username === env.USERNAME) && (password === env.PASSWORD)) {
          return { username, password };
        } else {
          throw new Error("Unauthorized");
        }
      },
    }),
  };
  
  const handlers = {
    ["rpc"]: apiHandler,
    ["file-loader"]: (adapters: any) =>
      fileLoaderHandler({ ...adapters, middlewares }),
  };

  const ports = {
    ["deno-serve"]: denoServe,
    ["cloudfare-workers"]: cloudfare,
  };

  return {
    env,
    connectors,
    features,
    handlers,
    ports,
  };
};
