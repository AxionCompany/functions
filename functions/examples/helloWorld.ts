import type { OxianContext } from "../src/isolate-v2/types.ts";

// import node.js fs module
import fs from 'node:fs';
// import npm modules
import { v4 as uuidv4 } from 'npm:uuid';
// import jsr modules
import { assert } from 'jsr:@std/assert';


/**
 * This is a simple hello world example.
 */



export function GET(_: any, context?: OxianContext) {
  // testing :node modules import
  const dir = fs.readdirSync('./');
  // testing npm modules import
  const uuid = uuidv4();
  // testing jsr modules import
  assert(true);
  return { message: 'Hello World from GET method', dir, uuid, passed: true, dependencies: Object.keys(context?.dependencies || {}) };
}

export function POST(_: any, context?: OxianContext) {
  return { message: 'Hello World from POST method' };
}