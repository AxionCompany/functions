
const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
    </svg>
);

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a1 1 0 000 2h1v10a2 2 0 002 2h6a2 2 0 002-2V6h1a1 1 0 100-2h-1V3a1 1 0 00-1-1H6zm3 3h2v10H9V5zm-4 0h2v10H5V5zm10 0h-2v10h2V5z" clipRule="evenodd" />
    </svg>
);

const {useState, useEffect} = React;

const TasksPage = () => {
    const [tasks, setTasks] = useState([]);
    const [taskName, setTaskName] = useState('');

    useEffect(() => {
        fetch('/examples/api/tasks')
            .then(response => response.json())
            .then(data => setTasks(data));
    }, []);

    const addTask = (e) => {
        e.preventDefault();
        fetch('/examples/api/tasks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: taskName }),
        })
            .then(response => response.json())
            .then(newTask => {
                setTasks([...tasks, newTask]);
                setTaskName('');
            });
    };

    const deleteTask = (id) => {
        fetch(`/examples/api/tasks?id=${id}`, {
            method: 'DELETE',
        })
            .then(() => {
                setTasks(tasks.filter(task => task.id !== id));
            });
    };

    return (
        <div className="container mx-auto p-6">
            <h1 className="text-4xl font-bold mb-8 text-center">Task Management</h1>
            <form onSubmit={addTask} className="mb-8 flex justify-center items-center space-x-4">
                <input
                    type="text"
                    value={taskName}
                    onChange={(e) => setTaskName(e.target.value)}
                    placeholder="Enter task name"
                    className="input input-bordered w-full max-w-md"
                    required
                />
                <button type="submit" className="btn btn-primary flex items-center">
                    <PlusIcon />
                    Add Task
                </button>
            </form>
            <ul className="list-none p-0">
                {tasks.map(task => (
                    <li key={task.id} className="mb-4 flex items-center justify-between p-4 bg-base-200 rounded-lg shadow-lg transition transform hover:-translate-y-1 hover:shadow-xl space-x-4">
                        <span className="text-lg">{task.name}</span>
                        <button onClick={() => deleteTask(task.id)} className="btn btn-error btn-xs flex items-center">
                            <TrashIcon />
                            Delete
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default TasksPage;