# Oxian.js

Oxian.js is a full-stack development framework designed to simplify the process of developing applications. It leverages JavaScript (JS) and ES Modules, supporting both backend modules and front-end React components, with automatic routing and rendering. Oxian.js runs on the Deno runtime, eliminating the need for npm package management (but still compatible with it).

## Quick Start
Get started with Oxian.js in a few simple steps:

Create a simple React page:

```bash
mkdir functions
mkdir functions/pages

cat > functions/pages/home.jsx << EOF
export default function HomePage({ user = 'World' }) {
  return <div>Welcome to Oxian.js!</div>;
}
EOF
```

Create a simple API endpoint:

```bash
mkdir functions/api

cat > functions/api/hello.js << EOF
export default function ({ name = 'World' }) {
  return { message: \`Hello, \${name}!\` };
}
EOF
```

Start the server:
```bash
deno run -A https://raw.githubusercontent.com/AxionCompany/functions/main/main.ts
```

Test your endpoints:
- Frontend: Visit `http://localhost:9002/pages/home` to see your React component rendered
- Backend: `curl http://localhost:9002/api/hello?name=Oxian`

You now have a basic Oxian.js application up and running!

---

**⚠️ This project is under active development, APIs may change, and the documentation might not always be up to date.**

---

## Why we built Oxian.js
Oxian.js was developed by Oxian Company, a custom software development company. The main motivation behind creating this framework was to facilitate the development process for our projects, which predominantly use the JavaScript ecosystem for both frontend and backend development.

In many cases, traditional tools seemed unnecessarily complex or required extensive configuration for relatively simple tasks. We wanted a solution that would allow developers to build full-stack applications quickly, without the overhead of managing build tools, bundlers, or complex deployment setups.

We aim to provide a more streamlined development experience while maintaining the flexibility to handle complex requirements as applications grow. The focus on 'isolated processes' and the N+2 port requirement in Oxian.js are (albeit different) inspired by Deno Deploy's architecture, which ensures fast, isolated, and efficient execution of code.

**Our philosophy:**

We chose Deno as the foundation for Oxian.js because it offers:
- **Modern JavaScript**: Full support for ES Modules, TypeScript, and modern JS features out of the box
- **Security by default**: Permissions-based security model
- **No node_modules**: Direct import from URLs eliminates dependency management headaches
- **Web Standards**: Built on web platform APIs that developers already know

We believe that developers should spend more time creating and less time configuring. Oxian.js simplifies the development process by providing a unified environment for writing backend and front-end code, with automatic routing and rendering, but still - all of it as isolated processes. With Oxian.js, you can build full-stack applications quickly and efficiently, without the overhead of managing dependencies, build tools, routes, boilerplates, etc. Less configuration, more coding - that's the Oxian way.

---

## Getting Started

For a more detailed introduction to the system, check out the [ARCHITECTURE.md](./ARCHITECTURE.md) file, which provides a comprehensive overview of how the framework works.

For quick reference and common patterns, see the [Cheat_Sheet.md](./Cheat_Sheet.md).

### Prerequisites

Oxian.js runs on the Deno runtime. Ensure you have Deno installed on your machine. You can download and install Deno from [deno.land](https://deno.land/).

### Running Oxian.js

You can run Oxian.js in two ways:

**Method 1: Using deno task**

Create a `deno.json` file in your project root:

```json
{
    "tasks": {
        "start": "DENO_DIR=./data/oxian/cache/.deno ENV=production deno run -A --importmap=deno.json --no-lock --unstable-sloppy-imports  --no-prompt --unstable https://raw.githubusercontent.com/AxionCompany/functions/main/main.ts",
        "dev": "DENO_DIR=./data/oxian/cache/.deno ENV=development WATCH=true deno run --importmap=deno.json --reload=https://raw.githubusercontent.com/AxionCompany/functions/main -A --no-lock --unstable-sloppy-imports  --no-prompt --unstable https://raw.githubusercontent.com/AxionCompany/functions/main/main.ts"
    },
    "imports": {
        "react": "npm:react",
        "react-dom/server": "npm:react-dom/server"
    }
}
```

Optionally, create a configuration file:

```json
// oxian.config.json
{
    "dirEntrypoint": "index",
    "functionsDir": "functions"
}
```

And then run:
```bash
deno task start # for production
deno task dev   # for development with hot reload
```

**Method 2: Direct execution**

```json
{
    "tasks": {
        "start": "DENO_DIR=./data/oxian/cache/.deno ENV=production deno run -A --importmap=deno.json --no-lock --unstable-sloppy-imports  --no-prompt --unstable https://raw.githubusercontent.com/AxionCompany/functions/main/main.ts",
        "dev": "DENO_DIR=./data/oxian/cache/.deno ENV=development WATCH=true deno run --importmap=deno.json --reload=https://raw.githubusercontent.com/AxionCompany/functions/main -A --no-lock --unstable-sloppy-imports  --no-prompt --unstable https://raw.githubusercontent.com/AxionCompany/functions/main/main.ts"
    },
    "imports": {
        "react": "npm:react",
        "react-dom/server": "npm:react-dom/server",
        "oxian-components/": "https://raw.githubusercontent.com/AxionCompany/axions-web/main/src/components/",
        "oxian-modules/": "https://raw.githubusercontent.com/AxionCompany/functions/main/functions/modules/"
    }
}
```

Both methods will pull Oxian.js' code from GitHub and execute it on your local machine, starting the server.

---

## Backend Usage

Backend modules in Oxian.js are JavaScript files that export a default function. These functions are automatically mapped to API endpoints based on their file structure.

### Example: Basic API Endpoint

Create a file `functions/api/hello.js`:

```javascript
export default function({ name = 'World' }) {
  return { message: `Hello, ${name}!` };
}
```

This creates an API endpoint accessible at `http://localhost:9002/api/hello`.

### HTTP Methods

You can handle different HTTP methods by exporting named functions or using a default function:

```bash
curl -X GET "http://localhost:9002/api/hello?name=Oxian" // will execute the default export function
curl -X GET "http://localhost:9002/api/hello/GET?name=Oxian"
curl -X POST "http://localhost:9002/api/hello/POST" -d '{"name":"Oxian"}'
```

---

## Frontend Usage

Oxian.js will assume that front-end modules are React components, and will automatically render them in the browser. Any files with the .jsx or .tsx extension will be considered as React components.

### Example: Basic React Component

Create a file `functions/pages/home.jsx`:

```jsx
export default function HomePage({ user = 'Guest' }) {
  return (
    <div>
      <h1>Welcome, {user}!</h1>
      <p>This is your home page.</p>
    </div>
  );
}
```

- Open your browser and navigate to `http://localhost:9002/pages/home?user=Oxian` to see the HomePage component in action.

---

## Advanced Examples

### Backend: Task Management API

Create `functions/api/tasks.js`:

```javascript
const tasks = [];

export function GET() {
  return { tasks };
}

export function POST({ title, description }) {
  const task = { id: Date.now(), title, description, completed: false };
  tasks.push(task);
  return { task };
}

export function PUT({ id, completed }) {
  const task = tasks.find(t => t.id === parseInt(id));
  if (task) {
    task.completed = completed;
    return { task };
  }
  return { error: 'Task not found' };
}

export function DELETE({ id }) {
  const index = tasks.findIndex(t => t.id === parseInt(id));
  if (index !== -1) {
    const task = tasks.splice(index, 1)[0];
    return { task };
  }
  return { error: 'Task not found' };
}
```

Test the API:
```bash
curl -X GET "http://localhost:9002/api/tasks?name=Oxian"
curl -X POST "http://localhost:9002/api/tasks" -d '{"title":"Learn Oxian","description":"Explore the framework"}'
```

### Frontend: Task Management Interface

Create `functions/pages/tasks.jsx`:

```jsx
import { useState, useEffect } from 'react';

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({ title: '', description: '' });

  useEffect(() => {
    fetch('/api/tasks')
      .then(res => res.json())
      .then(data => setTasks(data.tasks));
  }, []);

  const addTask = async () => {
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTask)
    });
    const data = await response.json();
    setTasks([...tasks, data.task]);
    setNewTask({ title: '', description: '' });
  };

  return (
    <div>
      <h1>Task Management</h1>
      <div>
        <input
          type="text"
          placeholder="Title"
          value={newTask.title}
          onChange={(e) => setNewTask({...newTask, title: e.target.value})}
        />
        <input
          type="text"
          placeholder="Description"
          value={newTask.description}
          onChange={(e) => setNewTask({...newTask, description: e.target.value})}
        />
        <button onClick={addTask}>Add Task</button>
      </div>
      <ul>
        {tasks.map(task => (
          <li key={task.id}>
            <strong>{task.title}</strong>: {task.description}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Shared Modules

Oxian.js supports "shared" modules, which allow you to reuse code across multiple files in the same directory or any subdirectories. This helps keep your code DRY (Don't Repeat Yourself) and maintainable.

### How Shared Modules Work

Create a file named `shared.js` or `shared.ts` in any directory. This module will be automatically available to all files in the same directory and any subdirectories.

### Example: Database Connection Shared Module

Create `functions/shared.js`:

```javascript
// This will be available to all files in the functions directory and subdirectories
export const db = {
  users: [],
  
  addUser(user) {
    this.users.push({ id: Date.now(), ...user });
  },
  
  getUsers() {
    return this.users;
  }
};

export const config = {
  apiVersion: 'v1',
  maxUsers: 100
};
```

Now you can use this shared module in any API endpoint or page:

`functions/api/users.js`:
```javascript
import { db, config } from './shared.js';

export function GET() {
  return { users: db.getUsers(), version: config.apiVersion };
}

export function POST({ name, email }) {
  if (db.users.length >= config.maxUsers) {
    return { error: 'Maximum users reached' };
  }
  
  db.addUser({ name, email });
  return { success: true, users: db.getUsers() };
}
```

## Layout Components

Oxian.js also supports "layout" components, which allow you to define a common structure or layout for your frontend components. This is particularly useful for elements like headers, footers, navigation bars, and other UI components that should be consistent across multiple pages.

### How Layout Components Work

Create a file named `layout.jsx` or `layout.tsx` in any directory. This layout will be automatically applied to all pages in the same directory and any subdirectories.

### Example: Common Layout

Create `functions/pages/layout.jsx`:

```jsx
export default function Layout({ children, title = 'My App' }) {
  return (
    <html>
      <head>
        <title>{title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <header>
          <nav>
            <a href="/pages/home">Home</a>
            <a href="/pages/about">About</a>
            <a href="/pages/tasks">Tasks</a>
          </nav>
        </header>
        <main>
          {children}
        </main>
        <footer>
          <p>&copy; 2024 My App. All rights reserved.</p>
        </footer>
      </body>
    </html>
  );
}
```

Now all pages in the `functions/pages/` directory will automatically use this layout.

## Custom HTML Structure

Oxian.js allows you to customize the HTML structure of your pages by using index.html files. The closest index.html file to the current path will be considered, while higher-level index.html files are inherited but can be overridden.

### Example: Custom HTML Template

Create `functions/pages/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
    </style>
</head>
<body>
    <div class="container">
        {{content}}
    </div>
</body>
</html>
```

The `{{title}}` and `{{content}}` placeholders will be replaced with the appropriate content from your React components.

## Global CSS

Oxian.js supports the use of global CSS files, which can be defined at any level in the folder structure. These CSS files will be accumulated from the root directory up to the directory containing the current module, allowing for cascading styles and modular CSS organization.

### How Global CSS Works

Create CSS files in any directory within your functions folder. The framework will automatically include all CSS files found in the path hierarchy.

### Example: Global and Modular CSS

Create `functions/global.css`:
```css
/* Global styles applied to all pages */
body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    margin: 0;
    padding: 0;
    background-color: #f5f5f5;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}
```

Create `functions/pages/pages.css`:
```css
/* Styles specific to pages */
.page-header {
    background-color: #007bff;
    color: white;
    padding: 1rem;
    margin-bottom: 2rem;
}
```

## Configuration

Oxian.js aims to make the development process as straightforward as possible while still allowing for extensive configuration as applications scale. Configuration can be set via environment variables or a configuration file at the root of the project called oxian.config.json.

### Environment Variables

- **PORT**: The port number for the API server. Defaults to 9002.
- **FUNCTIONS_DIR**: The directory containing your functions. Defaults to 'functions'.
- **DIR_ENTRYPOINT**: The default file name to look for in directories (without extension). Defaults to 'index'.
- **DEBUG**: Enables Oxian.js logs for debugging purposes. Defaults to false.

### Configuration File

You can also set these configurations in a oxian.config.json file at the root of your project. Use camelCase for the properties.

#### Example oxian.config.json:

```json
{
  "port": 3000,
  "functionsDir": "src",
  "dirEntrypoint": "main",
  "debug": true
}
```

---

## Isolation and Architecture

Oxian.js is designed to provide an isolated and robust development environment, preventing errors from affecting the entire application. It achieves this through a system of process isolation and automatic recovery.

### Process Isolation

Each module or component in Oxian.js runs as an isolated process. This ensures that an error in one endpoint or component does not crash the entire application. This isolation is managed through the Deno runtime, leveraging its security model and process management capabilities.

### Port Requirements

To run an Oxian.js application, you will need 2+N ports, where N is the number of files that should be executed either as modules or components. The two essential ports are for the file loader and the API server. Each additional module gets its own port for complete isolation.

- **File Loader**: Default port 9000 (configurable)
- **API Server**: Default port 9002 (configurable)
- **Individual Modules**: Ports assigned dynamically starting from a base port

## Oxians

Oxians are the prebuilt modules and components that we have developed for our applications. These oxians represent the common functionalities we repeatedly use across different projects. By packaging these reusable pieces of code, we aim to increase productivity and maintain consistency in our applications.

### Using Oxians

The Oxian.js repository comes with a set of prebuilt oxians, both for backend modules and frontend components. These oxians are battle-tested in production environments and maintained by our team.

To use oxians in your project, you can import them using the oxian-modules and oxian-components import maps.

First, add the oxian imports to your `deno.json`:

```json
{
  "imports": {
    "react": "npm:react",
    "react-dom/server": "npm:react-dom/server",
    "oxian-modules/":"https://raw.githubusercontent.com/AxionCompany/functions/main/functions/modules/",
    "oxian-components/":"https://raw.githubusercontent.com/AxionCompany/axions-web/main/src/components/"
  }
}
```

Then import and use them in your code:

```javascript
import MongoDbCrud from "oxian-modules/features/crud/mongodb";
```

We intend to provide better documentation and a dedicated website for browsing and using these oxians in the future, but for now, please, refer to `/functions/components` and `/functions/modules` directories in the source code for examples.

### Extending with Oxians

Developers can easily extend their applications by incorporating these oxians. The modular nature of Oxian.js allows for seamless integration and customization, making it easy to adapt these prebuilt components to specific project requirements.

## Roadmap

Oxian.js is still in pre-release phase, and we are actively working on improving the framework and adding new features.

Our roadmap for Oxian.js includes the following features and improvements:

- **Enhanced Documentation**: Comprehensive guides, tutorials, and API references
- **Oxian Marketplace**: A dedicated website for browsing and using prebuilt oxians
- **Performance Optimizations**: Improved startup times, better caching, and optimized builds
- **Testing Framework**: Built-in testing utilities and patterns
- **Deployment Tools**: Simplified deployment to various platforms and cloud providers
- **IDE Integration**: Better development experience with code completion and debugging tools

## Performance Considerations

Oxian.js is still in early phases of development, and we started by prioritizing Developer Experience over performance. We are, however, committed to improving the performance of the framework over time.

Currently, the framework introduces some overhead due to:
- Process isolation requiring separate ports for each module
- Dynamic module loading and compilation
- File watching and hot reload capabilities in development mode

We are actively working on optimizations including:
- Better caching strategies
- Optimized bundling for production
- Reduced memory footprint
- Faster startup times

## Community and Support

For questions or issues, please open an issue in this repository or contact us at [functions@oxian.company].

