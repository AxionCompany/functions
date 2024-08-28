# Axion Functions Cheat Sheet

## Project structure:

```
my-project/
├── api/
│   └── hello.ts
│   └── shared.ts
├── pages/
│   └── home.jsx
│   └── [userId].jsx
│   └── layout.jsx
├── middleware.ts
├── interceptors.ts
├── axion.config.json
├── deno.json
```

## Backend Modules (`.ts` or `.js`)

```javascript
// api/hello.ts
const Greetings = (props) => {
    const { uuid } = Greetings;
    return `This is a uuidv4 from shared:${uuid()}`;
};

export const GET = (props) => `Hello, ${props.name || "World"} via GET!`;
export const POST = (props) => `Hello, ${props.name || "World"} via POST!`;

export default Greetings; // will be executed when method is DELETE or PUT, once GET and POST are explicitly defined;
```

## Frontend Components (`.jsx` or `.tsx`)

```jsx
// pages/home.jsx
import React from "npm:react";
const HomePage = (props) => <div>Welcome, {props.user || "Guest"}!</div>;
export default HomePage;
```

## Dynamic Routes

Use `[filename]` syntax:

```jsx
// pages/[userId].jsx
const UserProfile = (props) => <div>User Profile for ID: {props.userId}</div>;
export default UserProfile;
```

## Shared Modules (`.ts` or `.js`)

```javascript
// api/shared.js
// add uuidv4 to all modules inside /api/*
import { v4 as uuidv4 } from "npm:uuid";
export default (modules) => ({ ...modules, uuid: uuidv4 });
```

```javascript
// pages/shared.js
// add daisyui / tailwind using axion modules
import daisyui from "axion-modules/features/css/daisyUI.js";

export default (modules) => {
    const postCssConfig = daisyui({ themes: ["emerald"] });
    return { ...modules, postCssConfig };
};
```

## Middlewares
Middlewares will run each time a new request is received, before the function execution. Receives and returns the (possibly) mutated request object.
```javascript
// middlewares.js
// add a request counter to parameters
let counter = 0;
const middlewares = async (req) => {
    counter++;
    // req.params contains the same params that will be passed into the executed exported function.
    req.params.counter = counter;
    // adding `counter` to req.params will make it an available property to any function that uses this middleware
    return req;
};
```

## Interceptors
Interceptors will run in every function execution that has `__requestId__` passed as a property. Does not performs any mutations.

```javascript
// interceptors.js
// add an input log to each function execution that has __requestId__ as a property
export const beforeRun = (
    { name, url, requestId, executionId, input, properties },
) => {
    console.log(
        "INPUT |",
        JSON.stringify({ name, url, requestId, executionId, input }),
    );
    return;
};
// add an output log to each function execution that has __requestId__ as a property
export const afterRun = (
    { name, url, requestId, status, executionId, output, duration, properties },
) => {
    console.log(
        "OUTPUT |",
        JSON.stringify({ name, url, requestId, executionId, output, duration }),
    );
    return;
};
```

## Layout Components (`.jsx` or `.tsx`)
Layouts are HOC components. Can be accumulated in different parts of the file directory.
```jsx
// pages/layout.jsx
// add a header to all components inside pages/*
export default ({ children }) => (
    <>
        <header>Header</header>
        <div>{children}</div>
        <footer>Footer</footer>
    </>
);
```

## Custom HTML
Only the closest `index.html` to the executed file path is used (if exists).

Create `index.html` in desired directory

## Global CSS
`globals.css`can be accumulated over the file structure to compound different css classes available for different parts of the code

Create `globals.css` in desired directory.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

## Configuration

Use `axion.config.json` or environment variables:

```json
{
    "functionsDir": ".",
    "dirEntrypoint": "main"
}
```

## Using Axions (Pre-built Modules)

In `deno.json`:

```json
{
  ...
  "imports": {
    "axion-modules/": "https://raw.githubusercontent.com/AxionCompany/functions/release/functions/modules/"
  }
}
```

Usage:

```javascript
import MongoDbCrud from "axion-modules/features/crud/mongodb";
```

## Testing

- Backend: `curl http://localhost:9002/api/hello?name=Axion`
- Frontend: Open `http://localhost:9002/pages/home` in browser

```
This cheat sheet provides a quick reference for the main features and usage patterns of Axion Functions.
```
