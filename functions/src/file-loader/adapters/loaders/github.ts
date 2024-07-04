import { SEPARATOR, basename, extname, join, dirname } from "https://deno.land/std/path/mod.ts";

export default ({ config }: any) => {
  const GITHUB_API_URL = "https://api.github.com";
  const headers: any = {}
  if (config.apiKey) {
    headers.Authorization = `token ${config.apiKey}`;
  };

  const getExactRepoInfo = async (owner: string, repo: string, branch: string) => {
    const branchData = await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/branches/${branch}`, { headers }).then(res => res.json());
    const branchUrl = branchData?._links?.self;
    const exactRepo = branchUrl?.split('/').slice(-3, -2)?.[0];
    const exactBranch = branchData?.name;
    const exactOwner = branchUrl?.split('/')?.slice(-4, -3)?.[0];
    return { owner: exactOwner, repo: exactRepo, branch: exactBranch };
  };

  let gitInfo: any = getExactRepoInfo(config.owner, config.repo, config.branch);

  const fileExists = async (path: string) => {
    gitInfo = await gitInfo;
    try {
      const response = await fetch(`${GITHUB_API_URL}/repos/${gitInfo.owner}/${gitInfo.repo}/contents/${path}?ref=${gitInfo.branch}`, { headers, cache: "force-cache" });
      if (response.status === 200) {
        const data = await response.json();
        return data.type === "file";
      } else {
        return false;
      }
    } catch (err) {
      return false;
    }
  };

  const readTextFile = async (path: string) => {
    gitInfo = await gitInfo;

    const response = await fetch(`${GITHUB_API_URL}/repos/${gitInfo.owner}/${gitInfo.repo}/contents/${path}?ref=${gitInfo.branch}`, { headers, cache: "force-cache" });
    if (response.status === 200) {
      const data = await response.json();
      const content = atob(data.content);
      return content;
    } else {
      throw new Error(`Failed to fetch file: ${path}`);
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
      throw new Error(`Failed to fetch directory: ${path}`);
    }
  };

  return {
    fileExists,
    readTextFile,
    readDir,
  };


  return async function findFile(
    { path, currentPath = ".", params = {}, fullPath }:
      {
        path: string;
        currentPath: string;
        params: any;
        fullPath: string | undefined;
      },
  ): Promise<any> {

    const segments: Array<string> = path.replaceAll(SEPARATOR, "/").split("/").filter(Boolean);

    const mainEntrypoint = config?.dirEntrypoint || "index";

    fullPath = fullPath || path;

    const indexFile = join(currentPath, mainEntrypoint);
    const pathFile = join(currentPath, path);
    const fullPathFile = fullPath;
    const fullPathIndex = join(fullPathFile, mainEntrypoint);

    const segment = segments.shift();
    const matches: any = [];

    const pathFileExists = await fileExists(pathFile);

    if (pathFileExists) {
      return {
        content: await readTextFile(pathFile),
        matchPath: join('.', pathFile),
        path: fullPathFile,
        params,
      };
    }

    for (const entry of await readDir(currentPath)) {
      if (segments.length === 0 && entry.isFile) {
        const _currentPath = join(currentPath, entry.name);
        if (
          (extname(entry.name) && (
            pathFile.split(extname(entry.name))[0] ===
            _currentPath.split(extname(entry.name))[0]
          )) ||
          (pathFile === _currentPath)
        ) {
          return {
            content: await readTextFile(_currentPath),
            match: _currentPath,
            params,
            redirect: fullPath !== pathFile,
            path: join(
              dirname(fullPathFile),
              entry.name,
            ),
          };
        }

        const _currentIndexPath = join(currentPath, path, entry.name);
        if (
          (extname(entry.name) && (
            indexFile.split(extname(entry.name))[0] ===
            _currentIndexPath.split(extname(entry.name))[0]
          )) ||
          (indexFile === _currentIndexPath)
        ) {
          return {
            content: await readTextFile(_currentIndexPath),
            match: _currentIndexPath,
            params,
            redirect: _currentIndexPath !== pathFile,
            path: join(
              dirname(fullPathIndex),
              entry.name,
            ),
          };
        }

        const maybeVariable = basename(entry.name, extname(entry.name));
        if (maybeVariable.startsWith("[") && maybeVariable.endsWith("]")) {
          const variable = maybeVariable.slice(1, -1);
          params[variable] = segment;
          return {
            content: await readTextFile(_currentPath),
            match: _currentPath,
            params,
            redirect: true,
            path: join(
              dirname(fullPathFile),
              entry.name,
            ),
          };
        }
      }

      const entryName = basename(entry.name, extname(entry.name));
      if (
        entryName === segment ||
        entry.name === segment ||
        (entry.name.startsWith("[") && entry.name.endsWith("]"))
      ) {
        matches.push(entryName);
      }
    }

    matches.sort((a: any, b: any) => {
      if (a.startsWith("[") && a.endsWith("]")) return 1;
      if (b.startsWith("[") && b.endsWith("]")) return -1;
      return 0;
    });

    for (const match of matches) {
      const newPath = join(currentPath, match);
      const newParams = { ...params };
      if (match.startsWith("[") && match.endsWith("]")) {
        newParams[basename(match, extname(match)).slice(1, -1)] = segment;
      }
      const result = await findFile({
        path: join(...segments),
        currentPath: newPath,
        params: newParams,
        fullPath: fullPath || path,
      });

      if (result) return result;
    }

    return null;
  };
}
