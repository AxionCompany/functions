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
  const { FUNCTIONS_DIR, FILE_LOADER } = modules.env;
  let file;
  if (FILE_LOADER === "github") {
    file = await githubLoader()({
      owner: "AxionCompany",
      repo: "aion-ui",
      path: pathname,
      token,
    });
  } else {
    file = await localFileloader()({
      pathname: FUNCTIONS_DIR + pathname,
    });
  }
  return file
};
