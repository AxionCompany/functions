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

## Redirects

Modules receive a second argument `res` which is a response object. Use
`res.redirect` to redirect to another page.

```javascript
// main.ts
export default (props, res) => {
    return res.redirect("/pages/home");
};
```

## Custom Status Codes

Modules receive a second argument `res` which is a response object. Use
`res.status` and `res.statusText` to return a custom status code and text.

```javascript
// main.ts
export default (props, res) => {
    res.status(404);
    res.statusText("Not Found");
    return "Not Found";
};
```

## Error Handling

Throw an error to return a custom status code and text.

```javascript
// main.ts
export default (props) => {
    throw new { status: 404, message: "Not Found" }();
};
```

## Streams

Modules receive a second argument `res` which is a response object. Use
`res.stream` to add chunks to response stream.

```javascript
// main.ts
export default async (props, res) => {
    res.stream(`Hello, ${props.name || "World"}!`);
    const interval = setInterval(() => {
        res.stream(`It's ${new Date().toLocaleTimeString()}!`);
    }, 1000);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return () => clearInterval(interval);
};
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

Middlewares will run each time a new request is received, before the function
execution. Receives and returns the (possibly) mutated request object.

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

Interceptors will run in every function execution that has `__requestId__`
passed as a property. Does not performs any mutations.

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

Layouts are HOC components. Can be accumulated in different parts of the file
directory.

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

`globals.css`can be accumulated over the file structure to compound different
css classes available for different parts of the code

Create `globals.css` in desired directory.

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

## Configuration

Use `axion.config.json` or environment variables:

- `functionsDir`: Directory where modules/components will be exposed. (default:
  `.`)
- `dirEntrypoint`: Default file to be resolved when accessing a directory
  (default: `index`)

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

This cheat sheet provides a quick reference for the main features and usage patterns of Axion Functions.


=====
LLM GUIDELINES

- Do not use next.js or any other front-end framework other than react itself. Use window.location to change page / set query string params if necessary;
- `axion.config.json`, `shared.{js,ts}`, `middlewares.{js,ts}` and `layout.{jsx,tsx}` are optional. Prefer simplicity over complexity, and use them only if needed or in bigger projects.
- The function response will be returned as body of response automatically as plain text. If it's json parseable, it'll be added the json headers. If no errors, 200 status is assumed my default. On error you can throw {message, status} object, so the response status will be obtained from that.
- As we're using Deno, there's no need to "npm install". Just append the "npm:" specifier directly in your imports or (preferably) centralize imports in the importmap ("imports" property in Deno.json) by defining an alias.
- Unless users specify otherwise, always use daisyui for styling your front-end.