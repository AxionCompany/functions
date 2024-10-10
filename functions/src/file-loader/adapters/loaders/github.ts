export default ({ config, modules }: any) => {

  const withCache = modules.withCache;

  const GITHUB_API_URL = "https://api.github.com";

  const headers: any = {}
  if (config.apiKey) {
    headers.Authorization = `token ${config.apiKey}`;
  };


  const getExactRepoInfo = async (owner: string, repo: string, branch: string = 'main', environment: string = 'production') => {

    const url = `${GITHUB_API_URL}/repos/${owner}/${repo}/branches/${branch}`;
    const branchData = await withCache(
      (url: string, options: any) => fetch(url, options).then(async res => {
        if (res.status === 200) {
          const response = await res.json();
          console.log({ response });
          return response;
        } else {
          console.log(url, await res.json());
          return {}
        }
      }),
      { keys: ['github', url], bustCache: config.bustCache, cachettl: config.cachettl, useCache: config.useCache, },
      url,
      { headers }
    );

    console.log({ url, branchData });

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
    const repoVariablesUrl = `${GITHUB_API_URL}/repos/${gitInfo.owner}/${gitInfo.repo}/actions/variables?per_page=30`;
    const repoVariablesPromise = withCache(
      (url: string, options: any) => fetch(url, options).then(async res => {
        if (res.status === 200) {
          return res.json()
        } else {
          console.log(url, await res.json());
          return []
        }
      }),
      { keys: ['github', repoVariablesUrl], bustCache: config.bustCache, cachettl: config.cachettl, useCache: config.useCache, },
      repoVariablesUrl,
      { headers }
    );


    // get github environment variables
    let environmetVariablesPromises;
    if (gitInfo.environment) {
      const environmentVariablesUrl = `${GITHUB_API_URL}/repos/${gitInfo.owner}/${gitInfo.repo}/environments/${gitInfo.environment}/variables?per_page=30`;
      environmetVariablesPromises = withCache(
        (url: string, options: any) => fetch(url, options).then(async res => {
          if (res.status === 200) {
            return res.json()
          } else {
            console.log(url, await res.json());
            return []
          }
        }),
        { keys: ['github', environmentVariablesUrl], bustCache: config.bustCache, cachettl: config.cachettl, useCache: config.useCache, },
        environmentVariablesUrl,
        { headers }
      );
    }

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
      (url: string, options: any) => fetch(url, options).then(async res => {
        if (res.status === 200) {
          return res.json()
        } else {
          console.log(url, await res.json());
          return {
            content: {
              error: 'File not found'
            }
          }
        }
      }),
      { keys: ['github', url], bustCache: config.bustCache, cachettl: config.cachettl, useCache: config.useCache, },
      url,
      { headers }
    )

    const [response, variables] = await Promise.all([responsePromise, variablesPromise]);

    const content = atob(response.content);

    return { content, variables: { ENV: config.environment, ...variables } };

  };

  const readDir = async (path: string) => {
    const gitInfo = await gitInfoPromise;

    const url = `${GITHUB_API_URL}/repos/${gitInfo.owner}/${gitInfo.repo}/contents/${path}?ref=${gitInfo.branch}`;

    const response = await withCache(
      (url: string, options: any) => fetch(url, options).then(async res => {
        if (res.status === 200) {
          return res.json()
        } else {
          console.log(url, await res.json());
          return []
        }
      }),
      { keys: ['github', url], bustCache: config.bustCache, cachettl: config.cachettl, useCache: config.useCache, },
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
