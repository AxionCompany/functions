import type { OxianContext } from "../src/isolate-v2/types.ts";

/**
 * Interceptors are functions that run before and after a function is executed
 * They can be used to log, modify the request or response, or to add authentication
 * They are defined in the isolate.ts file
 */

/**
 * BeforeRun interceptor
 * 
 * @param {Object} data - The data of the request
 * @param {Object} context - The context of the request
 * @returns {Object} - The data
 */
export const beforeRun = (data: any, context: OxianContext) => {

    console.log(
        'BeforeRun',
        '| Function Name:', context.name,
        '| RequestID:', context.requestId,
        '| ExecutionId:', context.executionId,
        '| Timestamp:', context.timestamp,
        '| Dependencies:', context.dependencies ? JSON.stringify(Object.keys(context.dependencies)) : null,
        '| Request URL:', context.request?.url,
        '| Request Method:', context.request?.method,
        '| Request Headers:', context.request?.headers ? JSON.stringify(context.request.headers) : null,
        '| Request Body:', context.request?.body ? JSON.stringify(context.request.body) : null,
        '| Request Query Params:', context.request?.queryParams ? JSON.stringify(context.request.queryParams) : null,
        '| Input:', JSON.stringify(data)
    );
    return data;
}

/**
 * AfterRun interceptor
 * 
 * @param {Object} data - The data of the request
 * @param {Object} context - The context of the request
 * @returns {Object} - The data
 */
export const afterRun = (data: any, context: OxianContext) => {
    console.log(
        'AfterRun',
        '| Function Name:', context.name,
        '| RequestID:', context.requestId,
        '| ExecutionId:', context.executionId,
        '| Timestamp:', context.timestamp,
        '| Output:', JSON.stringify(data)
    );
    return data;
}