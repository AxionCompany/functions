/**
 * Environment variables utility module
 * 
 * This module provides functionality to load environment variables from both
 * .env files and the system environment.
 */

import { load } from "jsr:@std/dotenv";

/**
 * Environment variables record type
 */
export type EnvVars = Record<string, string>;

/**
 * Loads environment variables from .env file and system environment
 * 
 * This function attempts to load variables from a .env file first,
 * then merges them with system environment variables, with system
 * variables taking precedence.
 * 
 * @returns A record of environment variables
 */
export default async function getEnv(): Promise<EnvVars> {
  // Initialize empty object for .env variables
  let dotEnv: EnvVars = {};

  try {
    // Attempt to load variables from .env file
    dotEnv = await load();
  } catch (err) {
    // Log error but continue with empty object
    console.log('Error loading .env file:', err);
  }

  // Merge .env variables with system environment variables
  // System variables take precedence over .env variables
  const env: EnvVars = { 
    ...dotEnv, 
    ...Deno.env.toObject() 
  };
  
  return env;
}