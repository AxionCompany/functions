import { withCache } from "../../main.ts";

export default ({ config }: any) => {

    const BITBUCKET_API_URL = "https://api.bitbucket.org/2.0";

    const headers: any = {};
    if (config.apiKey) {
        headers.Authorization = `Bearer ${config.apiKey}`;
    }

    const getExactRepoInfo = async (workspace: string, repoSlug: string, branch: string, environment: string = 'production') => {

        const url = `${BITBUCKET_API_URL}/repositories/${workspace}/${repoSlug}/refs/branches/${branch}`;

        const branchData = await withCache(
            (url: string, options: any) => fetch(url, options).then(res => res.status === 200 ? res.json() : ""),
            { keys: ['bitbucket', url], useCache: undefined, cachettl: undefined },
            url,
            { headers }
        );

        const exactRepo = branchData?.name;
        const exactBranch = branchData?.name;
        const exactWorkspace = workspace;
        return { workspace: exactWorkspace, repo: exactRepo, branch: exactBranch, environment };
    };

    const gitInfoPromise: any = getExactRepoInfo(config.workspace, config.repoSlug, config.branch, config.environment)
        .then((data: any) => {
            return data;
        })
        .catch((err: any) => console.log(err));

    const getVariables = async () => {
        const gitInfo = await gitInfoPromise;

        // get bitbucket repository variables
        const repoVariablesUrl = `${BITBUCKET_API_URL}/repositories/${gitInfo.workspace}/${gitInfo.repo}/pipelines_config/variables/`;
        const repoVariablesPromise = withCache(
            (url: string, options: any) => fetch(url, options).then(res => res.status === 200 ? res.json() : ""),
            { keys: ['bitbucket', repoVariablesUrl], useCache: undefined, cachettl: undefined },
            repoVariablesUrl,
            { headers }
        );

        const repoVariables = await repoVariablesPromise;

        return (repoVariables?.values || []).reduce((acc: any, item: any) => {
            acc[item.key] = item.value;
            return acc;
        }, {}) || {};
    };

    const variablesPromise: any = gitInfoPromise.then(getVariables);

    const readTextFile = async (path: string) => {
        const gitInfo = await gitInfoPromise;

        const url = `${BITBUCKET_API_URL}/repositories/${gitInfo.workspace}/${gitInfo.repo}/src/${gitInfo.branch}/${path}`;

        const responsePromise = withCache(
            (url: string, options: any) => fetch(url, options).then(res => res.status === 200 ? res.json() : ""),
            { keys: ['bitbucket', url], useCache: undefined, cachettl: undefined },
            url,
            { headers }
        );

        const [response, variables] = await Promise.all([responsePromise, variablesPromise]);

        const content = response;

        return { content, variables };
    };

    const readDir = async (path: string) => {
        const gitInfo = await gitInfoPromise;

        const url = `${BITBUCKET_API_URL}/repositories/${gitInfo.workspace}/${gitInfo.repo}/src/${gitInfo.branch}/${path}`;

        const response = await withCache(
            (url: string, options: any) => fetch(url, options).then(res => res.status === 200 ? res.json() : ""),
            { keys: ['bitbucket', url], useCache: undefined, cachettl: undefined },
            url,
            { headers }
        );

        return response.values.map((entry: any) => ({
            name: entry.path.split('/').pop(),
            isFile: entry.type === "commit_file",
            isDirectory: entry.type === "commit_directory",
        }));

    };

    return {
        readTextFile,
        readDir,
        getVariables
    };
}
