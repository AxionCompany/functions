export default ({ config }: any) => {
  const GITHUB_API_URL = "https://api.github.com";
  const headers: any = {}
  if (config.apiKey) {
    headers.Authorization = `token ${config.apiKey}`;
  };

  const getExactRepoInfo = async (owner: string, repo: string, branch: string) => {
    const branchData = await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/branches/${branch}`, { headers, cache: "force-cache" }).then(res => res.json());
    const branchUrl = branchData?._links?.self;
    const exactRepo = branchUrl?.split('/').slice(-3, -2)?.[0];
    const exactBranch = branchData?.name;
    const exactOwner = branchUrl?.split('/')?.slice(-4, -3)?.[0];
    return { owner: exactOwner, repo: exactRepo, branch: exactBranch };
  };

  let gitInfo: any = getExactRepoInfo(config.owner, config.repo, config.branch)
    .then((data: any) => {
      return data
    })
    .catch((err: any) => console.log(err));

  const readTextFile = async (path: string) => {
    gitInfo = await gitInfo;

    const response = await fetch(`${GITHUB_API_URL}/repos/${gitInfo.owner}/${gitInfo.repo}/contents/${path}?ref=${gitInfo.branch}`, { headers, cache: "force-cache" });
    if (response.status === 200) {
      const data = await response.json();
      const content = atob(data.content);
      return content;
    } else {
      console.log('ERROR readTextFile', response)
      return "";
    }
  };

  const readDir = async (path: string) => {
    gitInfo = await gitInfo;

    const response = await fetch(`${GITHUB_API_URL}/repos/${gitInfo.owner}/${gitInfo.repo}/contents/${path}?ref=${gitInfo.branch}`, { headers, cache: "force-cache" });
    if (response.status === 200) {
      const data = await response.json();
      return data.map((entry: any) => ({
        name: entry.name,
        isFile: entry.type === "file",
        isDirectory: entry.type === "dir",
      }));
    } else {
      console.log('ERROR readDir', response)
      return [];
    }
  };

  return {
    readTextFile,
    readDir,
  };
}
