import type { OxianContext } from "../../../src/isolate-v2/types.ts";

/**
 * GET /examples/:id - Shows an example of a function with a path parameter
 * 
 * @returns {Object} - The echo of the id
 * @throws {Error} - If the id is not a number
 */

interface Result {
    message: string;
}

export default (_: any, context?: OxianContext): Result => {
    const url = new URL(context?.request?.url || '')
    return { message: `This is the default entrypoint for handlePathParams directory. If you want to test with path params, try calling ${url.origin}/examples/handlePathParams/:id` }
}