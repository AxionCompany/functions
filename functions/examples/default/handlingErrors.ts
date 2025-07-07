/**
 * This is a function that will be called when the user calls /examples/default/errorResponse
 * It will throw an error with a status code and status text
 */

/**
 * GET /examples/errorResponse - Shows an example of a function with an error response
 * 
 * @param {Object} data - The data of the request
 * @param {number} data.statusCode - The status code of the response
 * @param {string} data.statusText - The status text of the response
 * @throws {Object} - The error response
 */

interface ErrorProperties {
    statusCode?: number
    statusText?: string
}

export default ({ statusCode, statusText }: ErrorProperties) => {

    /**
     * we're using the statusCode and statusText from the 
     * request only as an example to show the status code and 
     * text can be set dynamically in the response
     */
    
    if (statusCode || statusText) {
        throw {
            /*
             * throwing an object with 'code' property will set the status code of the response
             * default is 500
             * */
            code: Number(statusCode || 500),
            /*
             * throwing an object with 'message' property will set the status text of the response
             * default is 'Internal Server Error'
             * */
            message: statusText || 'Internal Server Error'
        }
    }

    /**
     * if no status code or status text is provided, throw an error
     * this will set the status code to 500 and the status text to 'Internal Server Error'
     * the response object will be the error object, containing the stack trace
     * */
    throw new Error('Internal Server Error')
}