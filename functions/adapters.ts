import githubFileloader from "./connectors/github-fileloader.js";
import localFileloader from "./connectors/local-fileloader.js";
import moduleLoaderProvider from "./connectors/module-loader.ts";
import localSourcematch from "./connectors/local-sourcematch.ts";

import { config } from "https://deno.land/x/dotenv/mod.ts";

export default (adapters = undefined) => {

  const env = { ...Deno.env.toObject(), ...config() };

  const sourceMatch = localSourcematch({
    config: {
      dirEntrypoint: env.DIR_ENTRYPOINT,
      functionsDir: env.FUNCTIONS_DIR,
      loaderType: env.DEFAULT_LOADER_TYPE,
      owner: env.GIT_OWNER,
      repo: env.GIT_REPO,
      token: env.GIT_TOKEN,
    },
  });

  const fileLoader = {
    github: githubFileloader,
    local: localFileloader,
  };

  const moduleLoader = moduleLoaderProvider({
    config: {
      username: env.USERNAME,
      password: env.PASSWORD,
      loaderUrl: env.FILE_LOADER_URL,
      functionsDir: env.FUNCTIONS_DIR,
    },
  });

  return {
    env,
    sourceMatch,
    fileLoader,
    moduleLoader,
  };
};
