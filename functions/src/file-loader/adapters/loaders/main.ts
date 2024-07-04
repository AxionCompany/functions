import { SEPARATOR, basename, extname, join, dirname } from "https://deno.land/std/path/mod.ts";

export default ({ config }: any) => {

    const loaderFunctionsPromise = import('./' + config.loaderType + '.ts').then(m => m.default(config));

    return async function findFile(
        { path, currentPath = ".", params = {}, fullPath }:
            {
                path: string;
                currentPath: string;
                params: any;
                fullPath: string | undefined;
            },
    ): Promise<any> {

        const { fileExists, readTextFile, readDir } = await loaderFunctionsPromise;

        const segments: Array<string> = path.replaceAll(SEPARATOR, "/").split("/").filter(Boolean);

        const mainEntrypoint = config?.dirEntrypoint || "index";

        const pathFile = join(currentPath, path);

        const segment = segments.shift();
        const matches: any = [];
        
        const pathFileExists = await fileExists(pathFile);
        if (pathFileExists) {
            return {
                content: await readTextFile(pathFile),
                matchPath: join('.', pathFile),
                path,
                params,
            };
        }
        const maybeReturn = [];
        const dirFiles = await readDir(currentPath);
        let addSegment;
        for (const entry of dirFiles) {
            console.log('Checking entry', entry.name, 'for', segment, 'in', currentPath, 'with', segments, 'remaining')
            // Last segment. Check for matches. First, match by file name, Then by index file, and finally by variable
            if (
                segments.length === 0
            ) {
                // Priority 1: Check if the file name matches the path
                const _currentPath = join(currentPath, entry.name);
                if (
                    (extname(entry.name) && (
                        pathFile.split(extname(entry.name))[0] ===
                        _currentPath.split(extname(entry.name))[0]
                    ))
                ) {
                    console.log('adding', _currentPath, 'to maybeReturn')
                    maybeReturn.push({
                        priority: 1,
                        content: await readTextFile(_currentPath),
                        match: _currentPath,
                        params,
                        redirect: fullPath !== pathFile,
                        path: join(
                            // dirname(fullPathFile),
                            fullPath ||'',
                            entry.name,
                        ),
                    });
                }
                // Priority 2: Check if the entry name matches a variable
                const maybeVariable = basename(entry.name, extname(entry.name));
                if (
                    extname(entry.name) &&
                    maybeVariable.startsWith("[") &&
                    maybeVariable.endsWith("]")
                ) {
                    console.log('adding', _currentPath, 'to maybeReturn')
                    const variable = maybeVariable.slice(1, -1);
                    params[variable] = segment;
                    maybeReturn.push({
                        priority: 2,
                        content: await Deno.readTextFile(_currentPath),
                        match: _currentPath,
                        params,
                        redirect: true,
                        path: join(
                            // dirname(fullPathFile),
                            fullPath || '',
                            entry.name,
                        ),
                    })
                }

            }

            // If it is not the last segment, check for matches and continue recursively
            const entryName = basename(entry.name, extname(entry.name));
            if (
                (entry.name.startsWith("[") && entry.name.endsWith("]")) // Check if the entry name is a variable
                && segments.length
            ) {
                // Add the match to the matches array
                console.log('adding', entryName, 'to matches')
                matches.push(entryName);
            } else if (
                entryName === segment // Check if the entry name matches the segment without extension
            ) {
                if (
                    !segments.length
                    && segment !== mainEntrypoint
                ) {
                    console.log('adding', mainEntrypoint, 'to segments')
                    addSegment = mainEntrypoint;

                }
                console.log('adding', entryName, 'to matches')
                matches.push(entryName);
            }
        }

        addSegment && segments.push(mainEntrypoint)

        if (maybeReturn.length > 0) {
            const priority = maybeReturn.find(i => i.priority === 1);
            if (priority) return priority;
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
                fullPath: join(fullPath || '', match),
            });

            if (result) {
                maybeReturn.push({
                    ...result
                });
            } // Successful match found
        }

        if (maybeReturn.length > 0) {
            maybeReturn.sort((a: any, b: any) => a.priority - b.priority);
            return maybeReturn[0];
        }

        return null; // No valid paths found
    };
}
