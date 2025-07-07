/**
 * This is a function that will be called when the user calls /examples/default/usingHttpMethods
 * It will return the tasks
 */

const uuid = () => crypto.randomUUID()

let tasks: { id: string, name: string }[] = [];

/**
 * GET /examples/usingHttpMethods - Shows an example of a function with a GET request
 * 
 * @returns {Object} - The tasks
 */
export const GET = () => {
    return tasks;
};

/**
 * POST /examples/usingHttpMethods - Shows an example of a function with a POST request
 * 
 * @param {Object} data - The data of the request
 * @param {string} data.name - The name of the task
 * @returns {Object} - The task
 */
export const POST = ({ name }: { name: string }) => {
    const task = { id: uuid(), name };
    tasks.push(task);
    return task;
};

/**
 * PUT /examples/usingHttpMethods - Shows an example of a function with a PUT request
 * 
 * @param {Object} params - The parameters of the request
 * @param {string} params.id - The id of the task
 * @returns {Object} - The task
 */
export const PUT = (params: { id: string }) => {
    const { id } = params;
    tasks = tasks.filter(task => task.id !== id);
    console.log('TASKS', tasks);
    return { success: true };
};

/**
 * DELETE /examples/usingHttpMethods - Shows an example of a function with a DELETE request
 * 
 * @param {Object} params - The parameters of the request
 * @param {string} params.id - The id of the task
 * @returns {Object} - The task
 */
export const DELETE = (params: { id: string }) => {
    const { id } = params;
    tasks = tasks.filter(task => task.id !== id);
    console.log('TASKS', tasks);
    return { success: true };
};


