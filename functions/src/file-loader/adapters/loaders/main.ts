import { SEPARATOR, basename, extname, join } from "https://deno.land/std/path/mod.ts";

export default ({ config, modules }: any) => {

    const loaderFunctionsPromise = import(`./${config.loaderType}.ts`).then(m => m.default({ config, modules }));

    return async function findFile(
        { path, currentPath = ".", params = {}, fullPath }:
            {
                path: string;
                currentPath: string;
                params: any;
                fullPath: string | undefined;
            },
    ): Promise<any> {

        const mainEntrypoint = config?.dirEntrypoint || "index";

        const { readTextFile, readDir } = await loaderFunctionsPromise;

        path = (path)?.replaceAll(SEPARATOR, "/").split("/").filter(Boolean).length > 0 ? path : join(path, mainEntrypoint);

        const segments: Array<string> = (path)?.replaceAll(SEPARATOR, "/").split("/").filter(Boolean);

        const pathFile = join(currentPath, path);

        const segment = segments.shift();
        const matches: any = [];

        const maybeReturn = [];
        config.debug && console.log('Checking path', currentPath, 'for', segment, 'in', segments, 'remaining')
        const dirFiles = await readDir(currentPath);
        let addSegment;
        for (const entry of dirFiles) {
            config.debug && console.log('Checking entry', entry.name, 'for', segment, 'in', currentPath, 'with', segments, 'remaining')
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
                    config.debug && console.log(_currentPath, 'added to file candidates with priority 1', extname(path))
                    const { content, variables } = await readTextFile(_currentPath) || {};
                    maybeReturn.push({
                        priority: 1,
                        content,
                        variables,
                        matchPath: _currentPath.replace(/\\/g, '/'),
                        params,
                        redirect: !extname(path),
                        path: join(fullPath || '', path + (!extname(path) ? extname(entry.name) : '')).replace(/\\/g, '/'),
                    });
                }
                // Priority 2: Check if the entry name matches a variable
                const maybeVariable = basename(entry.name, extname(entry.name));
                if (
                    extname(entry.name) &&
                    maybeVariable.startsWith("[") &&
                    maybeVariable.endsWith("]")
                ) {
                    config.debug && console.log(_currentPath, 'added to file candidates with priority 2')
                    const variable = maybeVariable.slice(1, -1);
                    const newParams = { ...params };
                    newParams[variable] = basename(path, extname(path));
                    const { content, variables } = await readTextFile(_currentPath) || {};
                    maybeReturn.push({
                        priority: 2,
                        content,
                        variables,
                        matchPath: _currentPath.replace(/\\/g, '/'),
                        params: newParams,
                        redirect: !extname(path),
                        path: join(fullPath || '', path + (!extname(path) ? extname(entry.name) : '')).replace(/\\/g, '/'),
                    })
                }

            }

            // If it is not the last segment, check for matches and continue recursively
            const entryName = basename(entry.name, extname(entry.name));
            if (entry.isFile) continue;
            if (
                (entry.name.startsWith("[") && entry.name.endsWith("]")) // Check if the entry name is a variable
            ) {
                if (
                    !segments.length // If it is the last segment, add the main entrypoint to the segments array
                    && basename(path, extname(path)) !== mainEntrypoint // If the segment is not the main entrypoint
                ) {
                    config.debug && console.log('Adding main entrypoint to segments', entryName);
                    addSegment = mainEntrypoint; // Indicate that the main entrypoint should be added to the segments array for the next iteration after the for loop
                }
                // Add the match to the matches array
                config.debug && console.log('Partial path match with', entryName, 'adding to matches');
                matches.push(entryName);
            } else if (
                entryName === segment // Check if the entry name matches the segment without extension
            ) {
                if (
                    !segments.length // If it is the last segment, add the main entrypoint to the segments array
                    && segment !== mainEntrypoint // If the segment is not the main entrypoint
                ) {
                    config.debug && console.log('Adding main entrypoint to segments', entryName);
                    addSegment = mainEntrypoint; // Indicate that the main entrypoint should be added to the segments array for the next iteration after the for loop

                }
                config.debug && console.log('Partial path match with', entryName, 'adding to matches');
                matches.push(entryName); // Add the match to the matches array
            }
        }

        addSegment && segments.push(mainEntrypoint) // Add the main entrypoint to the segments array

        if (maybeReturn.length > 0) {
            // If there are any priority 1 matches in maybeReturn (i.e. the file name matches the path), return the first one
            const priority = maybeReturn.find(i => i.priority === 1);
            if (priority) return priority;
        }

        // Variable Matches should be last in matches array;
        matches.sort((a: any, b: any) => {
            // Sort the matches array so that variables are last
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
                fullPath: join(fullPath || '', segment || '')
            });

            // Successful match found, add it to maybeReturn
            if (result) {
                maybeReturn.push(result);
            }
        }

        // If there are any valid paths in maybeReturn, return the one with the highest priority
        if (maybeReturn.length > 0) {
            maybeReturn.sort((a: any, b: any) => a.priority - b.priority);
            return maybeReturn[0];
        }

        return null; // No valid paths found
    };
}
