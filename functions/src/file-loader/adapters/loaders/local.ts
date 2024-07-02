import { SEPARATOR, basename, extname, join, dirname } from "https://deno.land/std/path/mod.ts";

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

    // Get the next segment to match
    const segment = segments.shift();
    const matches: any = [];

    const pathFileExists = await fileExists(pathFile);

    if (pathFileExists) {
      return {
        content: await Deno.readTextFile(pathFile),
        matchPath: join('.', pathFile),
        path: fullPathFile,
        params,
      };
    }

    for await (const entry of Deno.readDir(currentPath)) {
      // Last segment. Check for matches. First, match by file name, Then by index file, and finally by variable
      if (segments.length === 0 && entry.isFile) {

        // Priority 1: Check if the file name matches the path
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
              dirname(fullPathFile),
              entry.name,
            ),
          };
        }

        // Priority 2: Check if the index file matches the path
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
              dirname(fullPathIndex),
              entry.name,
            ),
          };
        }

        // Priority 3: Check if the entry name matches a variable
        const maybeVariable = basename(entry.name, extname(entry.name));
        if (maybeVariable.startsWith("[") && maybeVariable.endsWith("]")) {
          const variable = maybeVariable.slice(1, -1);
          params[variable] = segment;
          return {
            content: await Deno.readTextFile(_currentPath),
            match: _currentPath,
            params,
            redirect: true,
            path: join(
              dirname(fullPathFile),
              entry.name,
            ),
          }
        }
      }

      // If it is not the last segment, check for matches and continue recursively
      const entryName = basename(entry.name, extname(entry.name));
      if (
        entryName === segment || // Check if the entry name matches the segment without extension
        entry.name === segment || // Check if the entry name matches the segment with extension
        (entry.name.startsWith("[") && entry.name.endsWith("]")) // Check if the entry name is a variable
      ) {
        // Add the match to the matches array
        matches.push(entryName);
      }
    }

    // Variable Matches should be last in matches array;
    matches.sort((a: any, b: any) => {
      if (a.startsWith("[") && a.endsWith("]")) return 1;
      if (b.startsWith("[") && b.endsWith("]")) return -1;
      return 0;
    });

    // Try each match recursively
    for (const match of matches) {
      // Create new path by joining the current path with the match
      const newPath = join(currentPath, match);
      // Create new params object and add the matched path variable in current segment to it
      const newParams = { ...params };
      if (match.startsWith("[") && match.endsWith("]")) {
        newParams[basename(match, extname(match)).slice(1, -1)] = segment;
      }
      // Recursively call findFile with the new path in order to find the matched file
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
