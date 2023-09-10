import githubFileloader from "../connectors/github-fileloader.js";
import localFileloader from "../connectors/local-fileloader.js";
import localSourcematch from "../connectors/local-sourcematch.ts";

export default ({ connectors, env }: any) => async (props: { pathname: string }) => {

  connectors = {
    ...connectors,
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
    }
  };

  const { fileLoader, sourceMatch } = connectors;

  const { config, pathname, loaderType } = await sourceMatch.default(props);

  console.log(`Loading file ${pathname} with loader ${loaderType}`);
  const { content, redirect } =
    (await fileLoader[loaderType]({ config: config })(
      {
        pathname: pathname,
      },
    )) || {};

  if (redirect) return { redirect };

  return { content };
};
