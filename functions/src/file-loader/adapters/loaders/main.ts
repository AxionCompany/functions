/**
 * File Loader Adapter Manager
 * 
 * This module provides a unified interface for loading files from various sources.
 * It dynamically loads the appropriate adapter based on the configuration and
 * implements a file finding algorithm that supports path variables and directory traversal.
 */

import { SEPARATOR, basename, extname, join } from "https://deno.land/std/path/mod.ts";
import { logDebug, logError, logInfo } from "../../../utils/logger.ts";

/**
 * Directory entry representing a file or directory
 */
export interface DirectoryEntry {
  /** Name of the file or directory */
  name: string;
  /** Whether the entry is a file */
  isFile: boolean;
  /** Whether the entry is a directory */
  isDirectory: boolean;
}

/**
 * File content with associated metadata
 */
export interface FileContent {
  /** Content of the file as string */
  content: string;
  /** Environment variables associated with the file */
  variables: Record<string, string>;
}

/**
 * File loader configuration
 */
export interface FileLoaderConfig {
  /** Type of loader to use (local, github, etc.) */
  loaderType: string;
  /** Directory entrypoint file name (default: "index") */
  dirEntrypoint?: string;
  /** Debug mode flag */
  debug?: boolean;
  /** Any additional properties */
  [key: string]: any;
}

/**
 * File loader modules
 */
export interface FileLoaderModules {
  /** Any modules needed by the loader */
  [key: string]: any;
}

/**
 * File finder parameters
 */
export interface FindFileParams {
  /** Path to find */
  path: string;
  /** Current path in the traversal */
  currentPath?: string;
  /** URL parameters collected during traversal */
  params?: Record<string, string>;
  /** Full path accumulated during traversal */
  fullPath?: string;
}

/**
 * File match result with priority and metadata
 */
export interface FileMatch {
  /** Priority of the match (lower is better) */
  priority: number;
  /** Content of the file */
  content?: string;
  /** Environment variables */
  variables?: Record<string, string>;
  /** Path that matched */
  matchPath: string;
  /** URL parameters */
  params: Record<string, string>;
  /** Whether to redirect */
  redirect: boolean;
  /** Path to redirect to */
  path: string;
}

/**
 * File loader adapter interface
 */
export interface FileLoaderAdapter {
  /** Read a text file and return its content with variables */
  readTextFile: (filePath: string) => Promise<FileContent | null>;
  /** Read a directory and return its entries */
  readDir: (directoryPath: string) => Promise<DirectoryEntry[]>;
}

/**
 * Creates a file loader with the given configuration and modules
 * 
 * @param options - Configuration and modules for the file loader
 * @returns A function that finds files based on the path
 */
export default function createFileLoader({ 
  config, 
  modules 
}: { 
  config: FileLoaderConfig; 
  modules: FileLoaderModules;
}) {
  logInfo("Creating file loader adapter manager with type:", config.loaderType);
  
  // Dynamically load the appropriate adapter
  const loaderPromise = import(`./${config.loaderType}.ts`)
    .then(module => module.default({ config, modules }) as FileLoaderAdapter)
    .catch(err => {
      logError(`Failed to load adapter ${config.loaderType}:`, err instanceof Error ? err.message : String(err));
      throw err;
    });

  /**
   * Finds a file based on the path
   * 
   * @param params - Parameters for finding the file
   * @returns File match result or null if not found
   */
  return async function findFile({
    path,
    currentPath = ".",
    params = {},
    fullPath
  }: FindFileParams): Promise<FileMatch | null> {
    // Get the main entrypoint from config or use default
    const mainEntrypointName = config?.dirEntrypoint || "index";
    
    try {
      // Wait for the loader to be ready
      const fileLoaderAdapter = await loaderPromise;
      
      // Normalize the path
      const normalizedPath = normalizePath(path, mainEntrypointName);
      
      // Split the path into segments
      const pathSegments = normalizedPath.replaceAll(SEPARATOR, "/").split("/").filter(Boolean);
      const fullPathToFile = join(currentPath, normalizedPath);
      
      // Get the first segment and remove it from the segments array
      const currentSegment = pathSegments.shift();
      
      logDebug("Finding file:", {
        normalizedPath,
        currentPath,
        currentSegment,
        remainingSegments: pathSegments.length
      });
      
      // Read the directory
      const directoryEntries = await fileLoaderAdapter.readDir(currentPath) || [];
      logDebug(`Found ${directoryEntries.length} entries in directory ${currentPath}`);
      
      // Potential matches with priorities
      const potentialMatches: FileMatch[] = [];
      
      // Flag to add the main entrypoint to segments
      let shouldAddMainEntrypoint = false;
      
      // Process each entry in the directory
      for (const directoryEntry of directoryEntries) {
        // If this is the last segment, check for direct matches
        if (pathSegments.length === 0) {
          await processLastSegment(
            directoryEntry,
            currentSegment,
            currentPath,
            fullPathToFile,
            normalizedPath,
                        params,
            fullPath,
            fileLoaderAdapter.readTextFile,
            potentialMatches,
            mainEntrypointName
          );
        }
        
        // If not the last segment, check for directory matches to continue traversal
        if (directoryEntry.isFile) continue;
        
        const entryNameWithoutExtension = basename(directoryEntry.name, extname(directoryEntry.name));
        
        // Check if the entry is a variable or matches the segment
        const isVariableSegment = directoryEntry.name.startsWith("[") && directoryEntry.name.endsWith("]");
        const matchesCurrentSegment = entryNameWithoutExtension === currentSegment;
        
        if (isVariableSegment || matchesCurrentSegment) {
          // If it's the last segment and not the main entrypoint, add the main entrypoint
          if (!pathSegments.length && currentSegment !== mainEntrypointName) {
            logDebug(`Adding main entrypoint ${mainEntrypointName} to segments`);
            shouldAddMainEntrypoint = true;
          }
          
          logDebug(`Found match: ${directoryEntry.name} for segment: ${currentSegment}`);
        }
      }
      
      // Add main entrypoint if needed
      if (shouldAddMainEntrypoint) {
        pathSegments.push(mainEntrypointName);
      }
      
      // If we have direct matches, return the highest priority one
      if (potentialMatches.length > 0) {
        // First check for priority 0 (directory entrypoint)
        const directoryEntrypointMatch = potentialMatches.find(match => match.priority === 0);
        if (directoryEntrypointMatch) return directoryEntrypointMatch;
        
        // Then check for priority 1 (direct match)
        const directMatch = potentialMatches.find(match => match.priority === 1);
        if (directMatch) return directMatch;
        
        // Sort by priority and return the highest
        potentialMatches.sort((matchA, matchB) => matchA.priority - matchB.priority);
        return potentialMatches[0];
      }
      
      // Filter and sort directory entries for recursive traversal
      const matchingDirectories = directoryEntries
        .filter((entry: DirectoryEntry) => {
          const entryNameWithoutExtension = basename(entry.name, extname(entry.name));
          const isVariableSegment = entry.name.startsWith("[") && entry.name.endsWith("]");
          return !entry.isFile && (isVariableSegment || entryNameWithoutExtension === currentSegment);
        })
        .sort((entryA: DirectoryEntry, entryB: DirectoryEntry) => {
          // Variables come last in priority
          if (entryA.name.startsWith("[") && entryA.name.endsWith("]")) return 1;
          if (entryB.name.startsWith("[") && entryB.name.endsWith("]")) return -1;
            return 0;
        });

      // If we're at the end of the path and have a matching directory, check for entrypoint file
      if (pathSegments.length === 0 && matchingDirectories.length > 0) {
        // Only check for entrypoint if the path ends with a slash or is empty
        // This ensures we're only looking in the requested directory
        if (normalizedPath.endsWith('/') || normalizedPath === '') {
          for (const matchingDirectory of matchingDirectories) {
            // Skip variable directories for direct entrypoint check
            if (matchingDirectory.name.startsWith("[") && matchingDirectory.name.endsWith("]")) {
              continue;
            }
            
            // Only check the directory that matches the current segment
            if (basename(matchingDirectory.name, extname(matchingDirectory.name)) !== currentSegment) {
              continue;
            }
            
            const directoryPath = join(currentPath, matchingDirectory.name);
            const entrypointPath = join(directoryPath, mainEntrypointName);
            
            logDebug(`Checking for entrypoint file: ${entrypointPath}`);
            
            // Check if the entrypoint file exists
            const entrypointContent = await fileLoaderAdapter.readTextFile(entrypointPath);
            if (entrypointContent) {
              logDebug(`Found entrypoint file: ${entrypointPath}`);
              return {
                priority: 0,
                content: entrypointContent.content,
                variables: entrypointContent.variables,
                matchPath: entrypointPath.replace(/\\/g, '/'),
                params: params,
                redirect: false,
                path: join(fullPath || '', normalizedPath).replace(/\\/g, '/'),
              };
            }
          }
        }
      }
      
      // Try each matching directory recursively
      for (const matchingDirectory of matchingDirectories) {
        const nextPath = join(currentPath, matchingDirectory.name);
        const updatedParams = { ...params };
        
        // If it's a variable, extract the parameter
        if (matchingDirectory.name.startsWith("[") && matchingDirectory.name.endsWith("]")) {
          const parameterName = basename(matchingDirectory.name, extname(matchingDirectory.name)).slice(1, -1);
          updatedParams[parameterName] = currentSegment || '';
        }
        
        // Recursively find the file
        const recursiveResult = await findFile({
          path: join(...pathSegments),
          currentPath: nextPath,
          params: updatedParams,
          fullPath: join(fullPath || '', currentSegment || '')
        });
        
        // If found, add to potential matches
        if (recursiveResult) {
          potentialMatches.push(recursiveResult);
        }
      }
      
      // Return the highest priority match
      if (potentialMatches.length > 0) {
        potentialMatches.sort((matchA, matchB) => matchA.priority - matchB.priority);
        return potentialMatches[0];
      }
      
      // No matches found
      return null;
    } catch (err) {
      logError("Error finding file:", err instanceof Error ? err.message : String(err));
      return null;
    }
  };
}

/**
 * Normalizes a path, adding the main entrypoint if needed
 * 
 * @param originalPath - Path to normalize
 * @param mainEntrypointName - Main entrypoint file name
 * @returns Normalized path
 */
function normalizePath(originalPath: string, mainEntrypointName: string): string {
  // If the path is empty, return empty string
  if (!originalPath) return '';
  
  // If the path ends with a slash, it's a directory path
  const isDirectoryPath = originalPath.endsWith('/');
  
  // Get path segments
  const segments = originalPath.replaceAll(SEPARATOR, "/").split("/").filter(Boolean);
  
  // If there are no segments and it's not explicitly a directory path, return the main entrypoint
  if (segments.length === 0 && !isDirectoryPath) {
    return mainEntrypointName;
  }
  
  // If it's a directory path and doesn't already specify a file, preserve the trailing slash
  if (isDirectoryPath) {
    return segments.length > 0 ? `${segments.join('/')}/` : '/';
  }
  
  // Otherwise, return the original path
  return segments.join('/');
}

/**
 * Processes the last segment of a path to find direct matches
 * 
 * @param directoryEntry - Directory entry
 * @param currentSegment - Current path segment
 * @param currentPath - Current directory path
 * @param fullPathToFile - Full path to the file
 * @param normalizedPath - Normalized path
 * @param urlParams - URL parameters
 * @param accumulatedPath - Full path accumulated during traversal
 * @param readTextFile - Function to read a text file
 * @param potentialMatches - Array to store potential matches
 * @param mainEntrypointName - The directory entrypoint file name (e.g., "index")
 */
async function processLastSegment(
  directoryEntry: DirectoryEntry,
  currentSegment: string | undefined,
  currentPath: string,
  fullPathToFile: string,
  normalizedPath: string,
  urlParams: Record<string, string>,
  accumulatedPath: string | undefined,
  readTextFile: (filePath: string) => Promise<FileContent | null>,
  potentialMatches: FileMatch[],
  mainEntrypointName: string
): Promise<void> {
  const entryFullPath = join(currentPath, directoryEntry.name);
  const entryExtension = extname(directoryEntry.name);
  const entryNameWithoutExtension = basename(directoryEntry.name, entryExtension);
  
  // Priority 0: Directory entrypoint match (highest priority)
  // If the entry is a main entrypoint file (index.ts, etc.) AND we're in the correct directory
  if (entryExtension && 
      entryNameWithoutExtension === mainEntrypointName && 
      // Check if we're in the directory that was requested
      (normalizedPath.endsWith('/') || normalizedPath === '')) {
    logDebug(`Found directory entrypoint match: ${entryFullPath}`);
    
    const fileContent = await readTextFile(entryFullPath);
    if (fileContent) {
      potentialMatches.push({
        priority: 0, // Highest priority
        content: fileContent.content,
        variables: fileContent.variables,
        matchPath: entryFullPath.replace(/\\/g, '/'),
        params: urlParams,
        redirect: !extname(normalizedPath),
        path: join(accumulatedPath || '', normalizedPath + (!extname(normalizedPath) ? entryExtension : '')).replace(/\\/g, '/'),
      });
    }
    return; // Exit early since we found the highest priority match
  }
  
  // Priority 1: Direct file name match
  if (entryExtension && fullPathToFile.split(entryExtension)[0] === entryFullPath.split(entryExtension)[0]) {
    logDebug(`Found direct match: ${entryFullPath}`);
    
    const fileContent = await readTextFile(entryFullPath);
    if (fileContent) {
      potentialMatches.push({
        priority: 1,
        content: fileContent.content,
        variables: fileContent.variables,
        matchPath: entryFullPath.replace(/\\/g, '/'),
        params: urlParams,
        redirect: !extname(normalizedPath),
        path: join(accumulatedPath || '', normalizedPath + (!extname(normalizedPath) ? entryExtension : '')).replace(/\\/g, '/'),
      });
    }
  }
  
  // Priority 2: Variable match
  if (entryExtension && entryNameWithoutExtension.startsWith("[") && entryNameWithoutExtension.endsWith("]")) {
    logDebug(`Found variable match: ${entryFullPath}`);
    
    const variableName = entryNameWithoutExtension.slice(1, -1);
    const updatedParams = { ...urlParams };
    updatedParams[variableName] = basename(normalizedPath, extname(normalizedPath));
    
    const fileContent = await readTextFile(entryFullPath);
    if (fileContent) {
      potentialMatches.push({
        priority: 2,
        content: fileContent.content,
        variables: fileContent.variables,
        matchPath: entryFullPath.replace(/\\/g, '/'),
        params: updatedParams,
        redirect: !extname(normalizedPath),
        path: join(accumulatedPath || '', normalizedPath + (!extname(normalizedPath) ? entryExtension : '')).replace(/\\/g, '/'),
      });
    }
  }
}
