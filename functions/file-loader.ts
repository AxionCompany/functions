import githubLoader from "./connectors/github-fileloader.js";
import localFileloader from "./connectors/local-fileloader.js";

export default 
async (props: {
  url: string;
  pathname: string;
  token: string;
  env: any;
}) => {
  const { pathname, token, env } = props;
  const { FUNCTIONS_DIR, FILE_LOADER, GIT_OWNER, GIT_REPO } = env;
  let file;
  if (FILE_LOADER === "github") {
    file = await githubLoader({
      pathname: `/${FUNCTIONS_DIR}${pathname}`,
      token,
      owner: GIT_OWNER,
      repo: GIT_REPO,
    });
  } else {
    file = await localFileloader({
      pathname: FUNCTIONS_DIR + pathname,
    });
  }
  return file;
};
