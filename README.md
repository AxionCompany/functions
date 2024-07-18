# Axion Functions

Axion Functions is a full-stack development framework designed to simplify the process of developing applications. It leverages JavaScript (JS) and ES Modules, supporting both backend modules and front-end React components, with automatic routing and rendering. Axion Functions runs on the Deno runtime, eliminating the need for npm package management (but still compatible with it).

## Our Commitment

Our end goal is to increase productivity for JS developers, and our commitment is to always push the frontier 

## Why we built Axion Functions
Axion Functions was developed by Axion Company, a custom software development company. The main motivation behind creating this framework was to streamline the development process for our projects, which predominantly use the JavaScript stack. We found ourselves solving similar coding problems across different projects and wanted a way to reuse code snippets efficiently, both for backend modules and frontend components.

### Inspiration
The framework draws significant inspiration from several sources:

- **Module Federation in Webpack** : Developed by the amazing Zach Jackson, Module Federation provides a way to dynamically import modules across different projects. We extended this concept to Deno, taking advantage of its compatibility with Node modules and its ability to import modules from HTTP URLs with security restrictions.
- **Deno Deploy** : We were amazed by the speed and developer experience of Deno Deploy. The concepts of process isolation and the N+2 port requirement in Axion Functions are inspired by Deno Deploy's architecture, which ensures fast, isolated, and efficient execution of code.
- **Next.js** : Next.js is a popular React framework that simplifies the development of full-stack applications. We wanted to create a similar experience for Deno developers, allowing them to write backend modules and frontend components in a unified environment with automatic routing and rendering.

### Why Deno?
We chose Deno as the foundation for Axion Functions because it offers:

- Native TypeScript Support: Deno supports TypeScript out of the box, which aligns with our development needs.
- Secure by Default: Deno's security model allows us to specify permissions for file system access, environment variables, and network requests.
- Node Compatibility: Deno is compatible with Node modules, making it easy to reuse existing JavaScript code.
- HTTP Imports: Deno's ability to import modules directly from URLs simplifies dependency management and enhances modularity.

We believe that developers should spend more time creating and less time configuring. Axion Functions simplifies the development process by providing a unified environment for writing backend and front-end code, with automatic routing and rendering, but still - all of it as isolated processes. With Axion Functions, you can build full-stack applications quickly and efficiently, without the overhead of managing dependencies, build tools, routes, boilerplates, etc. Less configuration, more coding - that's the Axion way.

## Features

- **Full-Stack Development**: Write ES Modules for both backend and front-end components.
- **Automatic Routing**: File structure determines API endpoint routes and website paths.
- **Easy Imports**: Directly import npm packages using `npm:` specifiers.
- **Just-in-Time Building**: Automatic, on-the-fly building and caching of files.
- **Simplified Setup**: No need for `npm install` or manual builds.
- **Process Isolation**: Isolated execution of modules and components to prevent application-wide crashes.

## Installation

Axion Functions runs on the Deno runtime. Ensure you have Deno installed on your machine. You can download and install Deno from [deno.land](https://deno.land/).

## Starting the Application Server

To start the application, create a `deno.json` file with the following content:

```json
{
    "tasks": {
        "start": "PORT=8000 deno run -A -r --unstable --no-lock https://raw.githubusercontent.com/AxionCompany/functions/develop/main.ts",
        "dev": "WATCH=true deno run -A --reload=http://localhost:8001,https://raw.githubusercontent.com/AxionCompany/functions/ --unstable --no-lock https://raw.githubusercontent.com/AxionCompany/functions/develop/main.ts"
    }
}
```
This configuration defines two tasks:
- start: Runs the application on port 8000.
- dev: Runs the application in development mode with hot-reloading enabled.

### Add Configuration File
```json
// axion.config.json
{
    "functionsDir": ".",
    "dirEntrypoint": "main"
}
```

This configuration specifies that the current directory (.) should be served as the root directory for modules and components, and the default entry point for directories is main.

### Start the Application

To start the application, run:

```sh
deno task start
```
For development mode, run:

```sh
deno task dev
```
### Alternative: Using npm Scripts
If you prefer to use npm, you can create a package.json file with the following content:

```json
{
    "scripts": {
        "start": "PORT=8000 deno run -A -r --unstable --no-lock https://raw.githubusercontent.com/AxionCompany/functions/develop/main.ts",
        "dev": "WATCH=true deno run -A --reload=http://localhost:8001,https://raw.githubusercontent.com/AxionCompany/functions/ --unstable --no-lock https://raw.githubusercontent.com/AxionCompany/functions/develop/main.ts"
    }
}
```
To start the application using npm, run:

```sh
npm run start
```
For development mode, run:

```sh
npm run dev
```

Both methods will pull Axion Functions' code from GitHub and execute it on your local machine, starting the server.

* p.s.: even if using npm commands, you still need to have Deno installed on your machine. *


## Usage

1. **Creating Backend Modules**: Use `.ts` or `.js` extensions.
    ```javascript
    // backend/hello.ts
    export default (props) => {
        return `Hello, ${props.name || 'World'}!`;
    };

    export const GET = (props) => {
        return `Hello, ${props.name || 'World'} via GET!`;
    };

    export const POST = (props) => {
        return `Hello, ${props.name || 'World'} via POST!`;
    };
    ```

    **Testing Backend Modules with curl**:
    ```sh
    # Default export
    curl -X GET "http://localhost:9002/backend/hello?name=Axion"

    # GET method
    curl -X GET "http://localhost:9002/backend/hello/GET?name=Axion"

    # POST method
    curl -X POST "http://localhost:9002/backend/hello/POST" -d '{"name":"Axion"}'
    ```

2. **Creating Front-End Modules**: Use `.jsx` or `.tsx` extensions.
    ```jsx
    // pages/home.jsx
    import React from 'react';

    const HomePage = (props) => {
        return <div>Welcome, {props.user || 'Guest'}!</div>;
    };

    export default HomePage;
    ```

    **Testing Front-End Modules in Browser**:
    - Open your browser and navigate to `http://localhost:9002/pages/home?user=Axion` to see the HomePage component in action.

3. **Path Parameters**: Use `[filename]` syntax for dynamic routes.
    ```jsx
    // pages/[userId]/profile.jsx
    import React from 'react';

    const UserProfile = (props) => {
        return <div>User Profile for ID: {props.userId}</div>;
    };

    export default UserProfile;
    ```

    **Testing Dynamic Routes in Browser**:
    - Open your browser and navigate to `http://localhost:9002/pages/123/profile` to see the UserProfile component for user ID 123.

### Full-Stack Example: Mini Task Management Application

#### Backend Module
This backend module will handle adding, viewing, and deleting tasks. It will use an in-memory storage for simplicity.

```javascript
// api/tasks.ts
import { v4 as uuidv4 } from 'npm:uuid';

let tasks = [];

// Get all tasks
export const GET = () => {
    return tasks;
};

// Add a new task
export const POST = ({name}) => {
    const task = { id: uuidv4(), name };
    tasks.push(task);
    return task;
};

// Delete a task
export const DELETE = ({id}) => {
    tasks = tasks.filter(task => task.id !== id);
    return { success: true };
};
```

#### Testing Backend Module with curl:

```sh
# Get all tasks
curl -X GET "http://localhost:9002/api/tasks"

# Add a new task
curl -X POST "http://localhost:9002/api/tasks" -H "Content-Type: application/json" -d '{"name":"Sample Task"}'

# Delete a task (replace <task-id> with actual task ID)
curl -X DELETE "http://localhost:9002/api/tasks?id=<task-id>"
```

#### Front-End Component
This front-end component will interact with the backend to display the list of tasks and provide a form to add new tasks.

```jsx
// pages/tasks.jsx
import React, { useState, useEffect } from 'react';

const TasksPage = () => {
    const [tasks, setTasks] = useState([]);
    const [taskName, setTaskName] = useState('');

    useEffect(() => {
        fetch('/api/tasks')
            .then(response => response.json())
            .then(data => setTasks(data));
    }, []);

    const addTask = (e) => {
        e.preventDefault();
        fetch('/api/tasks', {
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
        fetch(`/api/tasks?id=${id}`, {
            method: 'DELETE',
        })
            .then(() => {
                setTasks(tasks.filter(task => task.id !== id));
            });
    };

    return (
        <div>
            <h1>Task Management</h1>
            <form onSubmit={addTask}>
                <input
                    type="text"
                    value={taskName}
                    onChange={(e) => setTaskName(e.target.value)}
                    placeholder="Enter task name"
                    required
                />
                <button type="submit">Add Task</button>
            </form>
            <ul>
                {tasks.map(task => (
                    <li key={task.id}>
                        {task.name} <button onClick={() => deleteTask(task.id)}>Delete</button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default TasksPage;
```

#### Testing Front-End Component in Browser:

Open your browser and navigate to `http://localhost:9002/pages/tasks` to see the task management application in action.

## Advanced Concepts
### Shared Modules
Axion Functions supports "shared" modules, which allow you to reuse code across multiple files in the same directory or any subdirectories. This helps keep your code DRY (Don't Repeat Yourself) and maintainable.

#### Example: Using Shared Modules

1. Create a Shared Module:

```javascript
// backend/shared.js
import { v4 as uuidv4 } from 'npm:uuid';

export default (modules) => ({ ...modules, uuid: uuidv4 });
```
2. Consume the Shared Module:

```javascript
// backend/tasks.ts
export const POST = (body) => {
    const { uuid } = POST;
    const task = { id: uuid(), ...body };
    tasks.push(task);
    return task;
};
```

In this example, the uuid function is shared across the backend directory and its subdirectories, allowing you to easily generate unique IDs in multiple modules without repeating the import statement.

### Layout Components
Axion Functions also supports "layout" components, which allow you to define a common structure or layout for your frontend components. This is particularly useful for elements like headers, footers, and menus that should be consistent across multiple pages.

#### Example: Using Layout Components

1. Create a Layout Component:

```jsx
// pages/layout.jsx
export default ({ children }) => {
    return (
        <>
            <header>This is a header</header>
            <main>{children}</main>
            <footer>This is a footer</footer>
        </>
    );
};
```
2. Consume the Layout Component:

```jsx
// pages/home.jsx
import React from 'react';

const HomePage = () => {
    return <div>Welcome to the Home Page!</div>;
};

export default HomePage;
```

In this example, any component declared in the pages directory (or its subdirectories) will automatically be wrapped with the layout component, including the header and footer.

### Nested Shared and Layout Files

Both "shared" modules and "layout" components can be nested within directories, and they will accumulate from the higher directories. This means you can have multiple layers of shared functionality and layouts, enhancing modularity and code reuse.

### Custom HTML (index.html)
Axion Functions allows you to customize the HTML structure of your pages by using index.html files. The closest index.html file to the current path will be considered, while higher-level index.html files will be ignored.

#### Example: Using index.html

1. Create an index.html File:
```html
<!-- pages/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Application</title>
</head>
<body>
    <div id="root"></div>
</body>
</html>
``` 
In this example, the index.html file will be used as the base HTML structure for all pages within the pages directory and its subdirectories.

### Global CSS (globals.css)

Axion Functions supports the use of global CSS files, which can be defined at any level in the folder structure. These CSS files will be accumulated from the root directory up to the directory containing the current file being executed.

#### Example: Using globals.css

1. Create a `globals.css` File in root directory:
```css
/* globals.css */
body {
    font-family: Arial, sans-serif;
    background-color: #f0f0f0;
}
```
2. Create a `globals.css` File in a `pages` directory:
```css
/* pages/globals.css */
h1 {
    color: blue;
}
```

In this example, the styles defined in the `globals.css` file at the root directory will be applied to all pages, and the styles in `pages/globals.css` will be applied to all pages within the pages directory and its subdirectories, accumulating with the root styles.

Any CSS file named `globals.css` will be automatically included in the HTML output, always respecting the hierarchy of the directories.

## Configuration
Axion Functions aims to make the development process as straightforward as possible while still allowing for extensive configuration as applications scale. Configuration can be set via environment variables or a configuration file at the root of the project called axion.config.json.

### Environment Variables

**FUNCTIONS_DIR** : Specifies the root directory to be served as modules or components. Files and directories outside this root will not be available on the web but can still be used in the project. Defaults to . (current directory).

```sh
export FUNCTIONS_DIR=src
```

**DIR_ENTRYPOINT** : Specifies the default file name to be considered as the main entry point in a directory. This makes it unnecessary to specify it when importing by the path of its parent directory. Defaults to index.

```sh
export DIR_ENTRYPOINT=main
```
**FILE_LOADER_URL**: Defines the URL where the file loader is running if the developer wants to run it separately. Defaults to http://localhost:9000.

```sh
export FILE_LOADER_URL=http://localhost:9001
```
**FILE_LOADER_PORT**: Specifies the port for the file loader. Defaults to 9000.

```sh
export FILE_LOADER_PORT=9001
```
**DEFAULT_LOADER_TYPE**: Specifies the loader type to load the files. Options are local or github, and it defaults to local.

```sh
export DEFAULT_LOADER_TYPE=github
```
**USE_CACHE**: Determines if the cache should be enabled by default when loading a file. Defaults to false if DEFAULT_LOADER_TYPE is local and true otherwise.

```sh
export USE_CACHE=true
```
**DEBUG**: Enables Axion Functions logs for debugging purposes. Defaults to false.

```sh
export DEBUG=true
```

### Configuration File
You can also set these configurations in a axion.config.json file at the root of your project. Use camelCase for the properties.

#### Example axion.config.json:

```json
{
    "functionsDir": "src",
    "dirEntrypoint": "main",
    "fileLoaderUrl": "http://localhost:9001",
    "fileLoaderPort": 9001,
    "defaultLoaderType": "github",
    "useCache": true,
    "debug": true
}
```
This configuration provides the flexibility needed for larger applications while maintaining the simplicity and ease of use for smaller projects.

## How it Works
Axion Functions is designed to provide an isolated and robust development environment, preventing errors from affecting the entire application. It achieves this through a system of process isolation and efficient resource management, inspired by Deno Deploy.

### Process Isolation
Each module or component in Axion Functions runs as an isolated process. This ensures that an error in one endpoint or component does not crash the entire application. This isolation is managed through the Deno runtime, leveraging its capabilities for secure, efficient execution. This approach borrows concepts from Deno Deploy, known for its fast deployment and excellent developer experience.

### Port Requirements
To run an Axion Functions application, you will need 2+N ports, where N is the number of files that should be executed either as modules or components. The two essential ports are for the file loader and the API server:

- File Loader Port: Used to load and serve files dynamically.
- API Server Port: Handles incoming API requests.
Each additional file being executed will run on its own port, managed by the Deno runtime. This structure ensures efficient handling of requests and execution of modules and components.

## Axions
Axions are the prebuilt modules and components that we have developed for our applications. These axions represent the common functionalities we repeatedly use across different projects. By packaging these reusable pieces of code, we aim to increase productivity and maintain consistency in our applications.

### Using Axions
The Axion Functions repository comes with a set of prebuilt axions, both for backend modules and frontend components. These axions are battle-tested in production environments and maintained by our team.

We provide a builtin we for using them in your project by using the `importAxion` function. This function will automatically load the axion from the specified path and execute it in your project. 

We intend to provide better documentation and a dedicated website for browsing and using these axions in the future, but for now, please, refer to `/functions/components` and `/functions/modules` directories in the source code for examples.

### Extending with Axions
Developers can easily extend their applications by incorporating these axions. The modular nature of Axion Functions allows for seamless integration and customization, making it easy to adapt these prebuilt components to specific project requirements.

## Roadmap

Axion functions is still in pre-release phase, and we are actively working on improving the framework and adding new features.

Our roadmap for Axion Functions includes the following features and improvements:

- **Improved Documentation**: Enhance the documentation with more examples, tutorials, and guides.
- **Trully Serverless Hosting**: Don't bother deploying your code, we'll serve it right from where it is - your git repository - and securely make it available for the world.
- **Performance Optimization**: Optimize the framework for faster execution and better resource management.
- **Testing and Quality Assurance**: Implement automated testing and quality assurance processes to ensure the stability and reliability of the framework.
- **Community Contributions**: Encourage community contributions and feedback to improve the framework and make it more accessible to developers.

## Performance

Axion Functions is still in early phases of development, and we started by prioritizing Developer Experience over performance. We are, however, committed to improving the performance of the framework as we continue to develop it. Our goal is to provide a fast and efficient development environment that can scale with your applications, and we will be working on optimizing the framework in the future.

**To do**: Add performance benchmarks and optimizations.

## Contributing

We welcome contributions! If you have ideas for new features, improvements, or bug fixes, please open an issue or submit a pull request. We are actively working on improving the framework and would love to have your input.

## License
This project is licensed under the MIT License. See the LICENSE file for details.

## Contact
For questions or issues, please open an issue in this repository or contact us at [functions@axion.company].

