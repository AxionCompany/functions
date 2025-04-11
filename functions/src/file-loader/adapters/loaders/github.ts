/**
 * GitHub File Loader Adapter
 * 
 * This module provides functionality for loading files from GitHub repositories.
 * It implements the file loader interface with readTextFile and readDir functions,
 * and handles GitHub API authentication, caching, and error handling.
 */

import { logDebug, logError } from "../../../utils/logger.ts";
import { DirectoryEntry, FileContent, FileLoaderAdapter } from "./main.ts";

/**
 * GitHub repository information
 */
export interface GitHubRepoInfo {
  /** Repository owner (username or organization) */
  owner: string;
  /** Repository name */
  repo: string;
  /** Branch name */
  branch: string;
  /** Environment name for variables */
  environment: string;
}

/**
 * GitHub API response for a variable
 */
interface GitHubVariable {
  /** Variable name */
  name: string;
  /** Variable value */
  value: string;
}

/**
 * GitHub loader configuration
 */
export interface GitHubLoaderConfig {
  /** Repository owner */
  owner: string;
  /** Repository name */
  repo: string;
  /** Branch name (defaults to 'main') */
  branch?: string;
  /** Environment name (defaults to 'production') */
  environment?: string;
  /** GitHub API key for authentication */
  apiKey?: string;
  /** Whether to use cache */
  useCache?: boolean;
  /** Whether to bust cache */
  bustCache?: boolean;
  /** Cache time-to-live in milliseconds */
  cachettl?: number;
  /** Debug mode flag */
  debug?: boolean;
  /** Any additional properties */
  [key: string]: any;
}

/**
 * GitHub loader modules
 */
export interface GitHubLoaderModules {
  /** Cache module for API requests */
  withCache: <T>(
    fn: (url: string, options: RequestInit) => Promise<T>,
    options: {
      keys: string[];
      bustCache?: boolean;
      cachettl?: number;
      useCache?: boolean;
    },
    url: string,
    requestOptions: RequestInit
  ) => Promise<T>;
  /** Any additional modules */
  [key: string]: any;
}

/**
 * Creates a GitHub file loader with the given configuration and modules
 * 
 * @param options - Configuration and modules for the GitHub loader
 * @returns A file loader adapter for GitHub repositories
 */
export default function createGitHubLoader({
  config,
  modules
}: {
  config: GitHubLoaderConfig;
  modules: GitHubLoaderModules;
}): FileLoaderAdapter {
  logDebug("Creating GitHub file loader adapter");

  const cacheModule = modules.withCache;
  const GITHUB_API_URL = "https://api.github.com";

  // Set up request headers with authentication if provided
  const requestHeaders: HeadersInit = {};
  if (config.apiKey) {
    requestHeaders.Authorization = `token ${config.apiKey}`;
  }

  /**
   * Gets exact repository information from GitHub API
   * 
   * @param ownerName - Repository owner
   * @param repoName - Repository name
   * @param branchName - Branch name (defaults to 'main')
   * @param environmentName - Environment name (defaults to 'production')
   * @returns Repository information with exact names
   */
  const getExactRepoInfo = async (
    ownerName: string,
    repoName: string,
    branchName: string = 'main',
    environmentName: string = 'production'
  ): Promise<GitHubRepoInfo> => {
    const branchUrl = `${GITHUB_API_URL}/repos/${ownerName}/${repoName}/branches/${branchName}`;

    try {
      const branchData = await cacheModule(
        async (url: string, options: RequestInit) => {
          const response = await fetch(url, options);

          if (response.status === 200) {
            return await response.json();
          } else if (response.status === 403) {
            throw new Error('GitHub API access forbidden. Check your API key.');
          } else {
            logError(`GitHub API error: ${response.status} ${response.statusText}`);
            return {};
          }
        },
        {
          keys: ['github', branchUrl],
          bustCache: config.bustCache,
          cachettl: config.cachettl,
          useCache: config.useCache
        },
        branchUrl,
        { headers: requestHeaders }
      );

      if (!branchData) {
        throw new Error('Repository or branch not found');
      }

      const repoUrlParts = branchData?._links?.self?.split('/') || [];
      const exactRepo = repoUrlParts.slice(-3, -2)?.[0];
      const exactBranch = branchData?.name;
      const exactOwner = repoUrlParts.slice(-4, -3)?.[0];

      return {
        owner: exactOwner,
        repo: exactRepo,
        branch: exactBranch,
        environment: environmentName
      };
    } catch (error) {
      logError("Error getting repository information:", error instanceof Error ? error.message : String(error));
      throw error;
    }
  };

  // Initialize repository info promise
  const repoInfoPromise: Promise<GitHubRepoInfo> = getExactRepoInfo(
    config.owner,
    config.repo,
    config.branch,
    config.environment
  ).catch((error) => {
    logError("Failed to get repository information:", error instanceof Error ? error.message : String(error));
    throw error;
  });

  /**
   * Gets environment variables from GitHub repository and environment
   * 
   * @returns Object containing all variables
   */
  const getVariables = async (): Promise<Record<string, string>> => {
    try {
      const repoInfo = await repoInfoPromise;

      // Get repository variables
      const repoVariablesUrl = `${GITHUB_API_URL}/repos/${repoInfo.owner}/${repoInfo.repo}/actions/variables?per_page=30`;
      const repoVariablesPromise = cacheModule(
        async (url: string, options: RequestInit) => {
          const response = await fetch(url, options);

          if (response.status === 200) {
            return await response.json();
          } else if (response.status === 403) {
            throw new Error('GitHub API access forbidden. Check your API key.');
          } else {
            logError(`GitHub API error: ${response.status} ${response.statusText}`);
            return { variables: [] };
          }
        },
        {
          keys: ['github', repoVariablesUrl],
          bustCache: config.bustCache,
          cachettl: config.cachettl,
          useCache: config.useCache
        },
        repoVariablesUrl,
        { headers: requestHeaders }
      );

      // Get environment variables if environment is specified
      let environmentVariablesPromise: Promise<{ variables: GitHubVariable[] }> = Promise.resolve({ variables: [] });

      if (repoInfo.environment) {
        const environmentVariablesUrl = `${GITHUB_API_URL}/repos/${repoInfo.owner}/${repoInfo.repo}/environments/${repoInfo.environment}/variables?per_page=30`;
        environmentVariablesPromise = cacheModule(
          async (url: string, options: RequestInit) => {
            const response = await fetch(url, options);

            if (response.status === 200) {
              return await response.json();
            } else if (response.status === 403) {
              throw new Error('GitHub API access forbidden. Check your API key.');
            } else {
              logError(`GitHub API error: ${response.status} ${response.statusText}`);
              return { variables: [] };
            }
          },
          {
            keys: ['github', environmentVariablesUrl],
            bustCache: config.bustCache,
            cachettl: config.cachettl,
            useCache: config.useCache
          },
          environmentVariablesUrl,
          { headers: requestHeaders }
        );
      }

      // Wait for both variable requests to complete
      const [repoVariables, environmentVariables] = await Promise.all([
        repoVariablesPromise,
        environmentVariablesPromise
      ]);

      // Combine variables into a single object
      const allVariables: Record<string, string> = {};

      // Add repository variables
      for (const variable of repoVariables?.variables || []) {
        allVariables[variable.name] = variable.value;
      }

      // Add environment variables
      for (const variable of environmentVariables?.variables || []) {
        allVariables[variable.name] = variable.value;
      }

      return allVariables;
    } catch (error) {
      logError("Error getting variables:", error instanceof Error ? error.message : String(error));
      return {};
    }
  };

  // Initialize variables promise
  const variablesPromise: Promise<Record<string, string>> = repoInfoPromise.then(getVariables);

  /**
   * Reads a text file from the GitHub repository
   * 
   * @param filePath - Path to the file in the repository
   * @returns File content and variables, or null if not found
   */
  const readTextFile = async (filePath: string): Promise<FileContent | null> => {
    try {
      const repoInfo = await repoInfoPromise;

      const fileUrl = `${GITHUB_API_URL}/repos/${repoInfo.owner}/${repoInfo.repo}/contents/${filePath}?ref=${repoInfo.branch}`;

      const [fileResponse, variables] = await Promise.all([
        cacheModule(
          async (url: string, options: RequestInit) => {
            const response = await fetch(url, options);

            if (response.status === 200) {
              return await response.json();
            } else if (response.status === 403) {
              throw new Error('GitHub API access forbidden. Check your API key.');
            } else {
              logError(`GitHub API error: ${response.status} ${response.statusText} for file ${filePath}`);
              return null;
            }
          },
          {
            keys: ['github', fileUrl],
            bustCache: config.bustCache,
            cachettl: config.cachettl,
            useCache: config.useCache
          },
          fileUrl,
          { headers: requestHeaders }
        ),
        variablesPromise
      ]);

      if (!fileResponse || !fileResponse.content) {
        logDebug(`File not found: ${filePath}`);
        return null;
      }

      // Decode base64 content
      const decodedContent = atob(fileResponse.content);

      return {
        content: decodedContent,
        variables: {
          ENV: repoInfo.environment,
          ...variables
        }
      };
    } catch (error) {
      logError("Error reading file:", error instanceof Error ? error.message : String(error));
      return null;
    }
  };

  /**
   * Reads a directory from the GitHub repository
   * 
   * @param directoryPath - Path to the directory in the repository
   * @returns Array of directory entries, or empty array if not found
   */
  const readDir = async (directoryPath: string): Promise<DirectoryEntry[]> => {
    try {
      const repoInfo = await repoInfoPromise;

      const directoryUrl = `${GITHUB_API_URL}/repos/${repoInfo.owner}/${repoInfo.repo}/contents/${directoryPath}?ref=${repoInfo.branch}`;

      const directoryContents = await cacheModule(
        async (url: string, options: RequestInit) => {
          const response = await fetch(url, options);

          if (response.status === 200) {
            return await response.json();
          } else if (response.status === 403) {
            throw new Error('GitHub API access forbidden. Check your API key.');
          } else {
            logError(`GitHub API error: ${response.status} ${response.statusText} for directory ${directoryPath}`);
            return [];
          }
        },
        {
          keys: ['github', directoryUrl],
          bustCache: config.bustCache,
          cachettl: config.cachettl,
          useCache: config.useCache
        },
        directoryUrl,
        { headers: requestHeaders }
      );

      if (!Array.isArray(directoryContents)) {
        logDebug(`Directory not found or not a directory: ${directoryPath}`);
        return [];
      }

      // Map GitHub API response to DirectoryEntry format
      return directoryContents.map((entry) => ({
        name: entry.name,
        isFile: entry.type === "file",
        isDirectory: entry.type === "dir",
      }));
    } catch (error) {
      logError("Error reading directory:", error instanceof Error ? error.message : String(error));
      return [];
    }
  };

  // Return the file loader adapter interface
  return {
    readTextFile,
    readDir
  };
}
