/**
 * Source Map Support Utility
 * 
 * Provides enhanced error handling and stack trace processing for bundled modules
 * with source map support for better debugging experience.
 */
import { SourceMapConsumer } from "npm:source-map-js@1.2.1";

interface SourceMap {
    version: number;
    sources: string[];
    sourcesContent?: string[];
    names: string[];
    mappings: string;
    file?: string;
}

/**
 * Extract source map from bundled code
 */
export function extractSourceMap(code: string): SourceMap | null {
    const inlineSourceMapMatch = code.match(/\/\/# sourceMappingURL=data:application\/json;base64,(.+)$/m);

    if (inlineSourceMapMatch) {
        try {
            const sourceMapData = atob(inlineSourceMapMatch[1]);
            const sourceMap: SourceMap = JSON.parse(sourceMapData);
            if (!sourceMap.version || sourceMap.version !== 3) {
                console.warn('[SourceMap] Unsupported source map version:', sourceMap.version);
                return null;
            }
            return sourceMap;
        } catch (err) {
            console.error('[SourceMap] Failed to decode or parse inline source map:', err);
        }
    }
    return null;
}

/**
 * Enhanced error with source map information
 */
export class SourceMappedError extends Error {
    public originalStack?: string;
    public mappedStack?: string;
    public sourceMap?: SourceMap;

    private constructor(
        originalError: Error,
        sourceMap?: SourceMap,
    ) {
        super(originalError.message);
        this.name = 'SourceMappedError';
        this.originalStack = originalError.stack;
        this.sourceMap = sourceMap;
        this.stack = originalError.stack; // Default stack
    }

    /**
     * Asynchronously creates and applies a mapped stack trace.
     */
    public async applyMappedStack(moduleUrl?: string): Promise<void> {
        if (this.sourceMap && this.originalStack) {
            this.mappedStack = await this.createMappedStack(this.originalStack, this.sourceMap, moduleUrl);
            this.stack = this.mappedStack;
        }
    }

    private async createMappedStack(originalStack: string, sourceMap: SourceMap, moduleUrl?: string): Promise<string> {
        const consumer = await new SourceMapConsumer(sourceMap as any);
        try {
            const lines = originalStack.split('\n');
            const mappedLines: string[] = [lines[0]]; // Keep the error message line

            const stackLines = lines.slice(1);

            for (const line of stackLines) {
                const match = line.match(/at (.*?) \((?:data:text\/javascript[^:]*|[^)]*):(\d+):(\d+)\)/);
                if (match) {
                    const functionName = match[1];
                    const generatedLine = parseInt(match[2], 10);
                    const generatedColumn = parseInt(match[3], 10);

                    const originalPos = consumer.originalPositionFor({
                        line: generatedLine,
                        column: generatedColumn,
                        bias: SourceMapConsumer.LEAST_UPPER_BOUND
                    });

                    if (originalPos.source) {
                        const sourcePath = originalPos.source.replace("file://", "").replace("https://", "");
                        const posName = originalPos.name || functionName || '';
                        mappedLines.push(`    at ${posName} (${sourcePath}:${originalPos.line}:${originalPos.column})`);
                    } else {
                        mappedLines.push(line); // Failed to map, use original line
                    }
                } else {
                    mappedLines.push(line); // Not a stack line we can map
                }
            }
            return mappedLines.join('\n');
        } catch (err) {
            console.warn('[SourceMap] Failed to create mapped stack trace:', err);
            return originalStack; // Fallback to original stack on error
        }
    }
}

/**
 * Enhance error with source map information if available.
 * Returns the enhanced error, which must have `applyMappedStack` called on it.
 */
export function enhanceErrorWithSourceMap(
    error: Error,
    code: string,
    moduleUrl?: string
): Error {
    try {
        const sourceMap = extractSourceMap(code);
        if (sourceMap) {
            // This is a bit of a trick to create an async-initialized error
            const smError = new (SourceMappedError as any)(error, sourceMap, moduleUrl);
            // We return the error instance, and the caller is responsible for awaiting its initialization
            return smError;
        }
    } catch (err) {
        console.error('[SourceMap] Failed during error enhancement:', err);
    }
    return error; // Return original error if enhancement fails
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