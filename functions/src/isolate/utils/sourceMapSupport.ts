/**
 * Source Map Support Utility
 * 
 * Provides enhanced error handling and stack trace processing for bundled modules
 * with source map support for better debugging experience.
 */

interface SourceMapPosition {
  source: string;
  line: number;
  column: number;
  name?: string;
}

interface SourceMap {
  version: number;
  sources: string[];
  sourcesContent?: string[];
  names: string[];
  mappings: string;
  file?: string;
}

// Cache for parsed source maps
const sourceMapCache = new Map<string, SourceMap>();

/**
 * Simple base64 VLQ decoder for source map mappings
 * This is a simplified version - for production use, consider using a full library
 */
function decodeVLQ(str: string): number[] {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const result: number[] = [];
  let index = 0;
  
  while (index < str.length) {
    let value = 0;
    let shift = 0;
    let continuation = true;
    
    while (continuation && index < str.length) {
      const char = str[index++];
      const digit = chars.indexOf(char);
      
      continuation = (digit & 32) !== 0;
      value += (digit & 31) << shift;
      shift += 5;
    }
    
    // Convert from VLQ to signed integer
    result.push((value & 1) ? -(value >> 1) : (value >> 1));
  }
  
  return result;
}

/**
 * Parse source map from base64 encoded string
 */
function parseSourceMap(sourceMapData: string): SourceMap | null {
  try {
    const sourceMap: SourceMap = JSON.parse(sourceMapData);
    
    if (!sourceMap.version || sourceMap.version !== 3) {
      console.warn('[SourceMap] Unsupported source map version:', sourceMap.version);
      return null;
    }
    
    return sourceMap;
  } catch (err) {
    console.error('[SourceMap] Failed to parse source map:', err);
    return null;
  }
}

/**
 * Extract source map from bundled code
 */
export function extractSourceMap(code: string): SourceMap | null {
  // Look for inline source map
  const inlineSourceMapMatch = code.match(/\/\/# sourceMappingURL=data:application\/json;base64,(.+)$/m);
  
  if (inlineSourceMapMatch) {
    try {
      const sourceMapData = atob(inlineSourceMapMatch[1]);
      return parseSourceMap(sourceMapData);
    } catch (err) {
      console.error('[SourceMap] Failed to decode inline source map:', err);
    }
  }
  
  // Look for external source map reference
  const externalSourceMapMatch = code.match(/\/\/# sourceMappingURL=(.+)$/m);
  if (externalSourceMapMatch) {
    console.warn('[SourceMap] External source maps not yet supported:', externalSourceMapMatch[1]);
  }
  
  return null;
}

/**
 * Extract clean filename from a URL
 */
function extractCleanFilename(url: string): string {
  try {
    // Handle data URLs by trying to extract filename from them
    if (url.startsWith('data:')) {
      // Try to decode and extract filename from data URL
      const decodedUrl = decodeURIComponent(url);
      const filenameMatch = decodedUrl.match(/\/\/ (.+\.(?:ts|js|tsx|jsx))/);
      if (filenameMatch) {
        return filenameMatch[1];
      }
      return 'bundled-module.ts';
    }
    
    // For regular URLs, extract just the filename
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    
    // Return just the filename, or the last part of the path
    const parts = pathname.split('/');
    return parts[parts.length - 1] || 'module.ts';
  } catch {
    return 'unknown-module.ts';
  }
}

/**
 * Find original position from generated position using source map
 */
export function getOriginalPosition(
  sourceMap: SourceMap,
  line: number,
  column: number,
  moduleUrl?: string
): SourceMapPosition | null {
  // This is a simplified implementation
  // For full source map support, consider using a dedicated library
  
  if (!sourceMap.sources || sourceMap.sources.length === 0) {
    return null;
  }
  
  // Use the clean filename from moduleUrl if available, otherwise extract from sources
  const cleanFilename = moduleUrl ? extractCleanFilename(moduleUrl) : extractCleanFilename(sourceMap.sources[0]);
  
  // For now, return the first source with adjusted line numbers
  // This is a fallback that works for simple cases
  return {
    source: cleanFilename,
    line: Math.max(1, line - 2), // Rough adjustment for bundled code
    column: Math.max(0, column),
    name: undefined
  };
}

/**
 * Enhanced error with source map information
 */
export class SourceMappedError extends Error {
  public originalStack?: string;
  public mappedStack?: string;
  public sourceMap?: SourceMap;
  
  constructor(
    originalError: Error,
    sourceMap?: SourceMap,
    moduleUrl?: string
  ) {
    super(originalError.message);
    this.name = 'SourceMappedError';
    this.originalStack = originalError.stack;
    this.sourceMap = sourceMap;
    
    if (sourceMap && originalError.stack) {
      this.mappedStack = this.createMappedStack(originalError.stack, sourceMap, moduleUrl);
      this.stack = this.mappedStack;
    } else {
      this.stack = originalError.stack;
    }
  }
  
  private createMappedStack(originalStack: string, sourceMap: SourceMap, moduleUrl?: string): string {
    try {
      const lines = originalStack.split('\n');
      const mappedLines: string[] = [];
      const cleanFilename = moduleUrl ? extractCleanFilename(moduleUrl) : 'bundled-module.ts';
      
      for (const line of lines) {
        if (line.includes('data:text/javascript;base64,') || line.includes('data:text/typescript,')) {
          // This is a bundled module line, try to map it
          const match = line.match(/at (.+?) \((?:data:text\/(?:javascript|typescript)[^)]*|[^)]*) (?::(\d+):(\d+))?\)/);
          if (match) {
            const functionName = match[1];
            const generatedLine = match[2] ? parseInt(match[2]) : 1;
            const generatedColumn = match[3] ? parseInt(match[3]) : 0;
            
            const originalPos = getOriginalPosition(sourceMap, generatedLine, generatedColumn, moduleUrl);
            if (originalPos) {
              mappedLines.push(`    at ${functionName} (${originalPos.source}:${originalPos.line}:${originalPos.column})`);
              continue;
            } else {
              // Fallback: use clean filename with original line/column
              mappedLines.push(`    at ${functionName} (${cleanFilename}:${generatedLine}:${generatedColumn})`);
              continue;
            }
          }
          
          // Try alternate pattern for different stack trace formats
          const altMatch = line.match(/at (.+?) \((.+)\)/);
          if (altMatch) {
            const functionName = altMatch[1];
            mappedLines.push(`    at ${functionName} (${cleanFilename}:1:0)`);
            continue;
          }
          
          // If no pattern matches, try to clean up the line anyway
          const cleanedLine = line.replace(/data:text\/(?:javascript|typescript)[^)]+/, cleanFilename);
          mappedLines.push(cleanedLine);
          continue;
        }
        
        mappedLines.push(line);
      }
      
      return mappedLines.join('\n');
    } catch (err) {
      console.warn('[SourceMap] Failed to create mapped stack trace:', err);
      return originalStack;
    }
  }
}

/**
 * Enhance error with source map information if available
 */
export function enhanceErrorWithSourceMap(
  error: Error,
  code: string,
  moduleUrl?: string
): Error {
  try {
    const sourceMap = extractSourceMap(code);
    
    if (sourceMap) {
      console.log(`[SourceMap] Enhancing error with source map for ${moduleUrl || 'unknown module'}`);
      return new SourceMappedError(error, sourceMap, moduleUrl);
    }
  } catch (err) {
    console.warn('[SourceMap] Failed to enhance error with source map:', err);
  }
  
  return error;
}

/**
 * Global error handler that provides source map enhanced errors
 */
export function installSourceMapSupport(): void {
  // Install global error handler for unhandled promise rejections
  globalThis.addEventListener?.('unhandledrejection', (event) => {
    if (event.reason instanceof Error) {
      console.error('[SourceMap] Unhandled promise rejection:', event.reason);
      
      // Try to enhance the error if it came from a bundled module
      const stack = event.reason.stack;
      if (stack && stack.includes('data:text/javascript;base64,')) {
        console.log('[SourceMap] Detected bundled module error, attempting source map enhancement');
      }
    }
  });
  
  // Install global error handler
  globalThis.addEventListener?.('error', (event) => {
    if (event.error instanceof Error) {
      console.error('[SourceMap] Global error:', event.error);
      
      // Try to enhance the error if it came from a bundled module
      const stack = event.error.stack;
      if (stack && stack.includes('data:text/javascript;base64,')) {
        console.log('[SourceMap] Detected bundled module error, attempting source map enhancement');
      }
    }
  });
  
  console.log('[SourceMap] Source map support installed');
} 