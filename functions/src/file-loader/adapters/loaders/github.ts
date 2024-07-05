import { withCache } from "../../main.ts";

export default ({ config }: any) => {
  const GITHUB_API_URL = "https://api.github.com";
  const headers: any = {}
  if (config.apiKey) {
    headers.Authorization = `token ${config.apiKey}`;
  };

  const getExactRepoInfo = async (owner: string, repo: string, branch: string) => {
    const url = `${GITHUB_API_URL}/repos/${owner}/${repo}/branches/${branch}`;

    const branchData = await withCache(
      (a: string, b: any) => fetch(a, b).then(res => res.status === 200 ? res.json() : ""),
      { keys: ['github', url], useCache: undefined, cachettl: undefined },
      url,
      { headers }
    )

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

    const url = `${GITHUB_API_URL}/repos/${gitInfo.owner}/${gitInfo.repo}/contents/${path}?ref=${gitInfo.branch}`;

    const response = await withCache(
      (a: string, b: any) => fetch(a, b).then(res => res.status === 200 ? res.json() : ""),
      { keys: ['github', url], useCache: undefined, cachettl: undefined },
      url,
      { headers }
    )
    const content = atob(response.content);
    return content;

  };

  const readDir = async (path: string) => {
    gitInfo = await gitInfo;

    const url = `${GITHUB_API_URL}/repos/${gitInfo.owner}/${gitInfo.repo}/contents/${path}?ref=${gitInfo.branch}`;

    const response = await withCache(
      (a: string, b: any) => fetch(a, b).then(res => res.status === 200 ? res.json() : ""),
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
  };
}
