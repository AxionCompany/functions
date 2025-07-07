/**
 * This is a function that will be called when the user calls /examples/default/stream
 * It will stream the response to the client
 */

import type { OxianContext } from "../../src/isolate-v2/types.ts";

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * GET /examples/stream - Shows an example of a function with a stream response
 * 
 * @param {Object} data - The data of the request
 * @param {Object} ctx - The context of the request
 * @returns {Object} - The stream response
 */
const stream = async (data: any, ctx: OxianContext): Promise<void> => {

    const url = ctx.request.url;
    // Extract the name parameter from the request
    const greetings = data?.name ? `Hello ${data.name}!` : "Hello!";
    // Send the greetings to the client in the stream
    ctx.response.stream(greetings + "\r\n" + 'from ' + JSON.stringify(url) + '\n');
    // This function will keep sending the current time to the client every second
    const interval = setInterval(() => {
        // Send the current time to the client in the stream
        ctx.response.stream("It's" + new Date().toISOString() + "\r\n")
    }, 1000);

    await sleep(15000); // wait for 15 seconds
    clearInterval(interval);

    /**
     * should always end a function with either a return or throw statement
     * uncomment the following line to see the error
    */

    // throw new Error('I am an error')

    return;
}

export default stream;