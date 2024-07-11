import { v4 as uuidv4 } from 'npm:uuid';

let tasks = [];

// Get all tasks
export const GET = () => {
    return tasks;
};

// Add a new task
export const POST = ({ name }) => {
    const task = { id: uuidv4(), name };
    tasks.push(task);
    return task;
};

// Delete a task
export const DELETE = (params) => {
    const { id } = params;
    tasks = tasks.filter(task => task.id !== id);
    return { success: true };
};
