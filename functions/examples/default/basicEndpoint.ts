import type { OxianContext } from "../../src/isolate-v2/types.ts";

/**
 * This is a basic endpoint that will be called when the user calls /examples/default/basicEndpoint
 * It will echo the data, ctx and dependencies
 */

/**
 * GET /examples/default/basicEndpoint - Shows an example of a function with a basic endpoint
 * 
 * @param {Object} data - The data of the request
 * @param {Object} ctx - The context of the request
 * @returns {Object} - The healthcheck response
 */

export default function basicEndpoint(data: any, ctx: OxianContext) {
    return {
        data: data, // data is the data (Json composed of query params, path params, form data and body) of the request
        ctx: Object.keys(ctx), // ctx is the complete context of the request
        dependencies: Object.keys(ctx.dependencies) // dependencies from dependencies.ts are available here
    }
}
