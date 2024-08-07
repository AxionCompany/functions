import { uuid } from 'npm:uuidv4';

let tasks = [];

// Get all tasks
export const GET = () => {
    return tasks;
};

// Add a new task
export const POST = ({ name }) => {
    const task = { id: uuid(), name };
    tasks.push(task);
    return task;
};

// Delete a task
export const DELETE = (params) => {
    const { id } = params;
    tasks = tasks.filter(task => task.id !== id);
    console.log('TASKS', tasks);
    return { success: true };
};
