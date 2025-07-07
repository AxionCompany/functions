/**
 * This is a function that will be called when the user calls /examples/handlePathParams/:id
 * It will echo the id
 */

/**
 * GET /examples/:id - Shows an example of a function with a path parameter
 * 
 * @param {string} id - The ID of the example to get
 * @returns {Object} - The echo of the id
 * @throws {Error} - If the id is not a number
 */
interface Params {
    id: string | number;
}

interface Result {
    id: number;
}

export default ({ id }: Params): Result => {
    const numId = Number(id);
    if (isNaN(numId)) {
        throw new Error('Id must be a number');
    }
    if (numId < 0) {
        throw new Error('Id must be a positive number');
    }
    if (numId > 100) {
        throw new Error('Id must be less than 100');
    }
    return { id: numId };
}