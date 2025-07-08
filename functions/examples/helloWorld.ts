import type { OxianContext } from "../src/isolate-v2/types.ts";

/**
 * This is a simple hello world example.
 */

export function GET(_: any, context?: OxianContext) {
  return { message: 'Hello World from GET method' };
}

export function POST(_: any, context?: OxianContext) {
  return { message: 'Hello World from POST method' };
}