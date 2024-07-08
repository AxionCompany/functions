import withCache from "../../../utils/withCache.ts";

export default ({ config }: any) => {

  const GITHUB_API_URL = "https://api.github.com";

  const headers: any = {}
  if (config.apiKey) {
    headers.Authorization = `token ${config.apiKey}`;
  };

  const getExactRepoInfo = async (owner: string, repo: string, branch: string = 'main', environment: string = 'production') => {

    const url = `${GITHUB_API_URL}/repos/${owner}/${repo}/branches/${branch}`;

    const branchData = await withCache(
      (url: string, options: any) => fetch(url, options).then(res => res.status === 200 ? res.json() : ""),
      { keys: ['github', url], useCache: undefined, cachettl: undefined },
      url,
      { headers }
    );

    const branchUrl = branchData?._links?.self;
    const exactRepo = branchUrl?.split('/').slice(-3, -2)?.[0];
    const exactBranch = branchData?.name;
    const exactOwner = branchUrl?.split('/')?.slice(-4, -3)?.[0];
    return { owner: exactOwner, repo: exactRepo, branch: exactBranch, environment };
  };

  const gitInfoPromise: any = getExactRepoInfo(config.owner, config.repo, config.branch, config.environment)
    .then((data: any) => {
      return data
    })
    .catch((err: any) => console.log(err));

  const getVariables = async () => {
    const gitInfo = await gitInfoPromise;

    // get github repository variables
    const repoVariablesUrl = `${GITHUB_API_URL}/repos/${gitInfo.owner}/${gitInfo.repo}/actions/variables`;
    const repoVariablesPromise = withCache(
      (url: string, options: any) => fetch(url, options).then(res => res.status === 200 ? res.json() : ""),
      { keys: ['github', repoVariablesUrl], useCache: undefined, cachettl: undefined },
      repoVariablesUrl,
      { headers }
    );

    // get github environment variables
    const environmentVariablesUrl = `${GITHUB_API_URL}/repos/${gitInfo.owner}/${gitInfo.repo}/environments/${gitInfo.environment}/variables`;
    const environmetVariablesPromises = withCache(
      (url: string, options: any) => fetch(url, options).then(res => res.status === 200 ? res.json() : ""),
      { keys: ['github', environmentVariablesUrl], useCache: undefined, cachettl: undefined },
      environmentVariablesUrl,
      { headers }
    );

    const [repoVariables, environmentVariables] = await Promise.all([repoVariablesPromise, environmetVariablesPromises]);

    return [...(repoVariables?.variables || []), ...(environmentVariables?.variables || [])]?.reduce((acc: any, item: any) => {
      acc[item.name] = item.value;
      return acc;
    }, {}) || {};
  };

  const variablesPromise: any = gitInfoPromise.then(getVariables);

  const readTextFile = async (path: string) => {
    const gitInfo = await gitInfoPromise;

    const url = `${GITHUB_API_URL}/repos/${gitInfo.owner}/${gitInfo.repo}/contents/${path}?ref=${gitInfo.branch}`;

    const responsePromise = withCache(
      (url: string, options: any) => fetch(url, options).then(res => res.status === 200 ? res.json() : ""),
      { keys: ['github', url], useCache: undefined, cachettl: undefined },
      url,
      { headers }
    )

    const [response, variables] = await Promise.all([responsePromise, variablesPromise]);

    const content = atob(response.content);

    return { content, variables };

  };

  const readDir = async (path: string) => {
    const gitInfo = await gitInfoPromise;

    const url = `${GITHUB_API_URL}/repos/${gitInfo.owner}/${gitInfo.repo}/contents/${path}?ref=${gitInfo.branch}`;

    const response = await withCache(
      (url: string, options: any) => fetch(url, options).then(res => res.status === 200 ? res.json() : ""),
      { keys: ['github', url], useCache: undefined, cachettl: undefined },
      url,
      { headers }
    )

    return response.map((entry: any) => ({
      name: entry.name,
      isFile: entry.type === "file",
      isDirectory: entry.type === "dir",
    }));

  };

  return {
    readTextFile,
    readDir,
    getVariables
  };
}
