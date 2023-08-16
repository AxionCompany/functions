import githubLoader from "./connectors/github-fileloader.js";
import localFileloader from "./connectors/local-fileloader.js";

export default (modules: {
  env: any;
}) =>
async (props: {
  url: string;
  pathname: string;
  token: string;
}) => {
  const { pathname, token } = props;
  const { FUNCTIONS_DIR, FILE_LOADER, GIT_OWNER, GIT_REPO } = modules.env;
  let file;
  if (FILE_LOADER === "github") {
    file = await githubLoader()({
      pathname: `/${FUNCTIONS_DIR}${pathname}`,
      token,
      owner:GIT_OWNER,
      repo:GIT_REPO
    });
  } else {
    file = await localFileloader()({
      pathname: FUNCTIONS_DIR + pathname,
    });
  }
  return file
};
