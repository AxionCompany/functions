import { basename, extname, join } from "https://deno.land/std/path/mod.ts";

const GITHUB_API_BASE = "https://api.github.com/repos";

const GithubApi = (owner:string, repo:string, ref:string, token:string) =>async (path:string)=>{
  const url = `${GITHUB_API_BASE}/${owner}/${repo}/contents/${path}${
    ref ? `?ref=${ref}` : ""
  }`;
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `token ${token}`);
  }
  const response = await fetch(url, { headers });

  const data = await response.json();

  return data
}


export default ({ config }: any) =>
  async function findFile(
    { path, currentPath = config?.functionsDir || ".", params = {}, fullPath }:
      {
        path: string;
        currentPath: string;
        params: any;
        fullPath: string;
      },
  ): Promise<any> {

        
    const segments: Array<string> = path.split("/").filter(Boolean);

    const mainEntrypoint = config?.dirEntrypoint || "index";

    fullPath = fullPath || path;

    const indexFile = join(currentPath, mainEntrypoint);
    const pathFile = join(currentPath, path);
    const fullPathFile = fullPath;
    const fullPathIndex = join(fullPathFile, mainEntrypoint);


    const githubInstance = GithubApi(
      config?.gitOwner,
      config?.gitRepo,
      config?.gitRef,
      config?.gitToken,
    );

    const fileExists = async (path: string, mainEntrypoint:string) => {
      try {
        const stats = await githubInstance(path);
        return stats?.type === 'file' ? stats : false;
      } catch (err) {
        return false;
      }
    };

    // Get the next segment to match
    const segment = segments.shift();
    const matches: any = [];

    const pathFileData = await fileExists(pathFile, mainEntrypoint);

    if(pathFileData) {
      return {
        content: atob(pathFileData?.content ),
        matchPath: (pathFileData ? pathFile : indexFile).split(`${config.functionsDir}/`).join(''),
        path: pathFileData? fullPathFile : fullPathIndex,
        params,
      };
    }
    
    const currentPathData = await githubInstance(currentPath);

    for (const entry of currentPathData) {
      // Check for an index file in the directory
      const _currentPath = join(currentPath, entry.name);
      const _currentIndexPath = join(currentPath, path, entry.name);

      if (segments.length === 0 && entry.type==='file') {
        if (
          (extname(entry.name) && (
            pathFile.split(extname(entry.name))[0] ===
              _currentPath.split(extname(entry.name))[0]
          )) ||
          (pathFile === _currentPath)
        ) {
          return {
            // content: atob(entry.content),
            match: _currentPath,
            params,
            redirect: fullPath !== pathFile,
            path: join(
              fullPathFile.slice(0, fullPathFile.lastIndexOf("/")),
              entry.name,
            ),
          };
        }
       
        if (
          (extname(entry.name) && (
            indexFile.split(extname(entry.name))[0] ===
              _currentIndexPath.split(extname(entry.name))[0]
          )) ||
          (indexFile === _currentIndexPath)
        ) {
          return {
            // content: atob(entry.content),
            match: _currentIndexPath,
            params,
            redirect: _currentIndexPath !== pathFile,
            path: join(
              fullPathFile,
              entry.name,
            ),
          };
        }
      }

      const entryName = basename(entry.name, extname(entry.name));
      if (
        entryName === segment ||
        entry.name === segment ||
        entry.name.startsWith(":")
      ) {
        matches.push(entryName);
      }
    }

    // Try each match recursively
    for (const match of matches) {
      const newPath = join(currentPath, match);
      const newParams = { ...params };

      if (match.startsWith(":")) {
        newParams[basename(match, extname(match)).slice(1)] = segment;
      }

      const result = await findFile({
        path: join(...segments),
        currentPath: newPath,
        params: newParams,
        fullPath: fullPath || path,
      });

      if (result) return result; // Successful match found
    }

    return null; // No valid paths found
  };
