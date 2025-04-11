/**
 * Local File Loader Adapter
 * 
 * This module provides functionality for loading files from the local file system.
 * It implements the file loader interface with readTextFile and readDir functions.
 */

import getEnv from "../../../utils/environmentVariables.ts";
import { logDebug, logError } from "../../../utils/logger.ts";

/**
 * File entry information
 */
export interface FileEntry {
  /** Name of the file or directory */
  name: string;
  /** Whether the entry is a file */
  isFile: boolean;
  /** Whether the entry is a directory */
  isDirectory: boolean;
}

/**
 * File content with variables
 */
export interface FileContent {
  /** Content of the file */
  content: string;
  /** Environment variables */
  variables: Record<string, string>;
}

/**
 * Local file loader configuration
 */
export interface LocalLoaderConfig {
  /** Debug mode flag */
  debug?: boolean;
  /** Any additional properties */
  [key: string]: any;
}

/**
 * Creates a local file loader with the given configuration
 * 
 * @param options - Configuration for the local file loader
 * @returns Object with readTextFile and readDir functions
 */
export default function createLocalLoader({ 
  config 
}: { 
  config: LocalLoaderConfig;
}) {
  logDebug("Creating local file loader");

  /**
   * Reads a text file from the local file system
   * 
   * @param path - Path to the file
   * @returns File content and variables, or null if the file cannot be read
   */
  const readTextFile = async (path: string): Promise<FileContent | null> => {
    if (!path) {
      logDebug("No path provided for readTextFile");
      return null;
    }

    try {
      logDebug(`Reading file: ${path}`);
      const content = await Deno.readTextFile(path);
      const variables = await getEnv();
      
      logDebug(`Successfully read file: ${path}`);
      return { content, variables };
    } catch (err) {
      logError(`Error reading file ${path}:`, err instanceof Error ? err.message : String(err));
      return null;
    }
  };

  /**
   * Reads a directory from the local file system
   * 
   * @param path - Path to the directory
   * @returns Array of file entries, or empty array if the directory cannot be read
   */
  const readDir = async (path: string): Promise<FileEntry[]> => {
    if (!path) {
      logDebug("No path provided for readDir");
      return [];
    }

    try {
      logDebug(`Reading directory: ${path}`);
      const files: FileEntry[] = [];
      
      for await (const dirEntry of Deno.readDir(path)) {
        files.push({
          name: dirEntry.name,
          isFile: dirEntry.isFile,
          isDirectory: dirEntry.isDirectory
        });
      }
      
      logDebug(`Successfully read directory: ${path}, found ${files.length} entries`);
      return files;
    } catch (err) {
      logError(`Error reading directory ${path}:`, err instanceof Error ? err.message : String(err));
      return [];
    }
  };

  // Return the file loader interface
  return {
    readTextFile,
    readDir,
  };
}
