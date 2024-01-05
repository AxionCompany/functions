import { basename, extname, join } from "https://deno.land/std/path/mod.ts";

const fileExists = async (path: string) => {
  try {
    const stats = await Deno.stat(path);
    return stats.isFile;
  } catch (err) {
    return false;
  }
};

export default ({ config }: any) =>
  async function findFile(
    { path, currentPath = config?.functionsDir || ".", params = {}, fullPath }:
      {
        path: string;
        currentPath: string;
        params: any;
        fullPath: string | undefined;
      },
  ): Promise<any> {
    const segments: Array<string> = path.split("/").filter(Boolean);

    const mainEntrypoint = config?.dirEntrypoint || "index";

    fullPath = fullPath || path;

    const indexFile = join(currentPath, mainEntrypoint);
    const pathFile = join(currentPath, path);
    const fullPathFile = fullPath;
    const fullPathIndex = join(fullPathFile, mainEntrypoint);

    // Get the next segment to match
    const segment = segments.shift();
    const matches: any = [];

    const pathFileExists = await fileExists(pathFile);
    const indexFileExists = await fileExists(indexFile);

    if (pathFileExists || indexFileExists) {
      return {
        content: await Deno.readTextFile(pathFile),
        matchPath: (pathFileExists ? pathFile : indexFile).split(`${config.functionsDir}/`).join(''),
        path: pathFileExists ? fullPathFile : fullPathIndex,
        params,
      };
    }

    for await (const entry of Deno.readDir(currentPath)) {
      // Check for an index file in the directory
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
            content: await Deno.readTextFile(_currentPath),
            match: _currentPath,
            params,
            redirect: fullPath !== pathFile,
            path: join(
              fullPathFile.slice(0, fullPathFile.lastIndexOf("/")),
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
            content: await Deno.readTextFile(_currentIndexPath),
            match: _currentIndexPath,
            params,
            redirect: _currentIndexPath !== pathFile,
            path: join(
              fullPathIndex.slice(0, fullPathIndex.lastIndexOf("/")),
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
        path: segments.join("/"),
        currentPath: newPath,
        params: newParams,
        fullPath: fullPath || path,
      });

      if (result) return result; // Successful match found
    }

    return null; // No valid paths found
  };
