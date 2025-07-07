import type { OxianContext } from "../src/isolate-v2/types.ts";

/**
 * Middleware is a function that runs before and after a function is executed
 * They can be used to log, modify the request or response, or to add authentication
 * They are defined in the isolate.ts file
 */

/**
 * Middleware example
 * 
 * @param {Object} data - The data of the request
 * @param {Object} context - The context of the request
 * @returns {Object} - The data
 */

let reqCounter = 0;
export default (data: any, context: OxianContext) => {
    reqCounter++;

    /**
     * This middleware will add a reqCounter to the data
     * and return the data
     * 
     * @returns {Object} - The data with the reqCounter
     */
    return {
        ...data,
        reqCounter
    }
}