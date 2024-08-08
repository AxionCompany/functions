
export default ({ config, modules }: any) => {

    const withCache = modules.withCache;

    const GITLAB_API_URL = "https://gitlab.com/api/v4";

    const headers: any = {};
    if (config.apiKey) {
        headers['PRIVATE-TOKEN'] = config.apiKey;
    }

    const getExactRepoInfo = async (projectId: string, branch: string, environment: string = 'production') => {

        const url = `${GITLAB_API_URL}/projects/${encodeURIComponent(projectId)}/repository/branches/${branch}`;

        const branchData = await withCache(
            (url: string, options: any) => fetch(url, options).then(res => res.status === 200 ? res.json() : ""),
            { keys: ['gitlab', url], useCache: undefined, cachettl: undefined },
            url,
            { headers }
        );

        const exactRepo = projectId;
        const exactBranch = branchData?.name;
        return { projectId: exactRepo, branch: exactBranch, environment };
    };

    const gitInfoPromise: any = getExactRepoInfo(config.projectId, config.branch, config.environment)
        .then((data: any) => {
            return data;
        })
        .catch((err: any) => console.log(err));

    const getVariables = async () => {
        const gitInfo = await gitInfoPromise;

        // get gitlab project variables
        const projectVariablesUrl = `${GITLAB_API_URL}/projects/${encodeURIComponent(gitInfo.projectId)}/variables`;
        const projectVariablesPromise = withCache(
            (url: string, options: any) => fetch(url, options).then(res => res.status === 200 ? res.json() : ""),
            { keys: ['gitlab', projectVariablesUrl], useCache: undefined, cachettl: undefined },
            projectVariablesUrl,
            { headers }
        );

        const projectVariables = await projectVariablesPromise;

        return (projectVariables || []).reduce((acc: any, item: any) => {
            acc[item.key] = item.value;
            return acc;
        }, {}) || {};
    };

    const variablesPromise: any = gitInfoPromise.then(getVariables);

    const readTextFile = async (path: string) => {
        const gitInfo = await gitInfoPromise;

        const url = `${GITLAB_API_URL}/projects/${encodeURIComponent(gitInfo.projectId)}/repository/files/${encodeURIComponent(path)}/raw?ref=${gitInfo.branch}`;

        const responsePromise = withCache(
            (url: string, options: any) => fetch(url, options).then(res => res.status === 200 ? res.text() : ""),
            { keys: ['gitlab', url], useCache: undefined, cachettl: undefined },
            url,
            { headers }
        );

        const [content, variables] = await Promise.all([responsePromise, variablesPromise]);

        return { content, variables };
    };

    const readDir = async (path: string) => {
        const gitInfo = await gitInfoPromise;

        const url = `${GITLAB_API_URL}/projects/${encodeURIComponent(gitInfo.projectId)}/repository/tree?path=${encodeURIComponent(path)}&ref=${gitInfo.branch}`;

        const response = await withCache(
            (url: string, options: any) => fetch(url, options).then(res => res.status === 200 ? res.json() : ""),
            { keys: ['gitlab', url], useCache: undefined, cachettl: undefined },
            url,
            { headers }
        );

        return response.map((entry: any) => ({
            name: entry.name,
            isFile: entry.type === "blob",
            isDirectory: entry.type === "tree",
        }));
    };

    return {
        readTextFile,
        readDir,
        getVariables
    };
}
