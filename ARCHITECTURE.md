# Axion Framework

Axion is a versatile server-side framework designed for modular and adaptable web applications. It leverages Deno's capabilities to provide a robust environment for building scalable and efficient web services.

## Key Components

### 1. Main Orchestrator (main.ts)

The main orchestrator initializes and manages two core components:

- **File Loader**: A worker responsible for handling file operations.
- **API Service**: A worker that processes API requests.

These components are initialized sequentially, with built-in error handling and restart mechanisms.

### 2. File Loader (file-loader.ts)

The File Loader is responsible for:

- Loading and caching project configurations (axion.config.json and deno.json).
- Handling file requests with support for various loaders (local, GitHub, etc.).
- Implementing caching strategies for improved performance.

### 3. API Service (api.ts)

The API Service:

- Loads project-specific adapters and configurations.
- Utilizes a proxy to handle incoming requests.
- Incorporates dynamic loading of modules based on request paths.

## Key Features

1. **Modular Architecture**: The framework is designed with modularity in mind, allowing easy extension and customization.

2. **Dynamic Configuration**: Project-specific configurations (axion.config.json and deno.json) are dynamically loaded and applied.

3. **Isolation**: The framework uses Deno's worker capabilities to isolate different components, enhancing stability and resource management.

4. **Caching**: Implements intelligent caching mechanisms for configurations and file content to optimize performance.

5. **Adaptable Routing**: Supports dynamic routing based on file structure and configurations.

6. **Environment Flexibility**: Easily adaptable to different environments (local, production) through environment variables.

7. **Error Handling**: Robust error handling and reporting mechanisms are in place throughout the system.

## How It Works

1. The main orchestrator initializes the File Loader.
2. Once the File Loader is ready, the API Service is initialized.
3. Incoming requests are handled by the API Service.
4. The API Service uses the File Loader to fetch necessary files and configurations.
5. Requests are processed using the appropriate modules and adapters.
6. Responses are sent back to the client.

This architecture allows for a flexible and scalable system that can adapt to various project requirements while maintaining performance and stability.


# Axion Framework Architecture

## Overview

Axion is a versatile server-side framework designed for building modular and adaptable web applications. It leverages Deno's capabilities to provide a robust environment for scalable and efficient web services.

## Key Components

### 1. Main Orchestrator (main.ts)

The main orchestrator initializes and manages two core components:

- **File Loader**: A worker responsible for handling file operations.
- **API Service**: A worker that processes API requests.

These components are initialized sequentially, with built-in error handling and restart mechanisms.

### 2. Server (server/main.ts)

The server component creates and manages the HTTP server:

- Handles incoming requests
- Manages CORS and OPTIONS requests
- Routes requests to the appropriate handler

Configuration options:
- `port`: Server port number (default: 8000)

### 3. Proxy (proxy/main.ts)

The proxy acts as the main request handler and manages isolates:


Key functionalities:
- Parses incoming request URLs
- Determines appropriate isolates for handling requests
- Creates, upgrades, and manages isolate lifecycles
- Forwards requests to isolates and streams responses back to clients

Configuration options:
- `isolateType`: Type of isolate to use (default: 'subprocess')
- `formatImportUrl`: Custom function to format import URLs
- `mapFilePathToIsolateId`: Custom function to map file paths to isolate IDs
- `shouldUpgradeAfter`: Timestamp for isolate upgrades
- `isolateMaxIdleTime`: Maximum idle time before terminating an isolate
- `debug`: Enable debug logging

### 4. File Loader (file-loader/main.ts)

Responsible for loading and processing files from various sources:

- Loads file content based on request paths
- Handles redirects
- Processes and transforms file content
- Sets appropriate content types

Configuration options:
- `loaderType`: Type of loader to use (e.g., "local", "github")
- `functionsDir`: Directory containing application functions
- `dirEntrypoint`: Default entrypoint file name

### 5. Isolate Adapters

#### 5.1 Regular Isolate (isolate/adapters/isolate.ts)

Handles regular JavaScript/TypeScript isolate initialization and execution:


#### 5.2 JSX Isolate (isolate/adapters/jsx-isolate.ts)

Handles JSX-specific isolate initialization and execution:


Both isolate adapters:
- Initialize the execution environment
- Set up global variables
- Configure caching mechanisms

Configuration options:
- `port`: Port number for the isolate server
- `projectId`: Unique identifier for the project

### 6. Module Execution (isolate/main.ts)

Responsible for executing modules within isolates:

- Loads and executes modules
- Handles server-side rendering for JSX components
- Processes CSS and injects it into rendered HTML
- Manages middleware execution and dependency injection

Configuration options:
- `loader`: Custom module loader function
- `functionsDir`: Directory containing application functions
- `dependencies`: External dependencies to be injected
- `isJSX`: Flag indicating whether to use JSX processing

## Request Flow

1. The server receives an incoming HTTP request.
2. The request is passed to the proxy component.
3. The proxy determines the appropriate isolate to handle the request:
   - If an isolate exists and is ready, it's used.
   - If no isolate exists or needs upgrading, a new one is created or upgraded.
4. The proxy forwards the request to the chosen isolate.
5. The isolate processes the request:
   - For JSX components, server-side rendering is performed.
   - For regular modules, the appropriate HTTP method handler is executed.
6. The response is processed and streamed back through the proxy to the client.

## Isolate Lifecycle

1. Isolates are created on-demand based on incoming requests.
2. Each isolate is associated with a specific file path and runs in a sandboxed environment.
3. Isolates can be upgraded if they become outdated (based on `shouldUpgradeAfter` config).
4. Idle isolates are terminated after a configurable period (`isolateMaxIdleTime`) to manage resources efficiently.

## Caching Strategies

- File content and processed data are cached to improve performance.
- Isolate metadata is cached to avoid unnecessary recreation of isolates.
- CSS processing results are cached and streamed asynchronously for optimal performance.

## Configuration and Customization

The Axion Framework allows for extensive configuration and customization:

1. Project-wide configuration:
   - `adapters.{ts|js}`: Overrides default behaviors of axion-functions.
   - `axion.config.json`: Defines project-wide settings
   - `deno.json`: Configures Deno-specific options

   Certainly! I'll add a section about how adapters can be used to modify the Axion components' behavior. Here's an addition to the ARCHITECTURE.md file focusing on adapters:

## Adapters

Adapters in the Axion Framework provide a powerful mechanism to customize and extend the behavior of various components. They are loaded dynamically and can modify the configuration and behavior of the system.

### Location and Loading

Adapters are typically located in the `${functionsDir}/adapters` directory. They are loaded dynamically when the API service initializes.

### Adapter Structure

An adapter is a module that exports a default function. This function receives the current configuration and can modify or extend it.

### Key Properties and Functions

Adapters can export and modify the following properties and functions:

1. `loaderConfig`: Configures the file loader behavior.
   - `username`: Sets the username for the file loader URL, that is used  by file-loader to determine the source for serving the files. Has the following format:
        - `${provider}--${org}--${repo}--${branch}--${environment}`.
        - By default, it'll consider `provider`= `local`, and load files for local filesystem.
   - `password`: Sets the password for the file loader URL (if applicable).

    example: for using the github file-loader and dynamically load a remote repository, you can use:
    ```js
    // For GitHub loader
   const fileLoaderUrl = new URL('https://your-file-loader-url');
    loaderConfig: {
      username: 'github--owner--repo--branch--environment';
      password: '<github_auth_token>'
    }
    ```

2. `shouldUpgradeAfter`: A timestamp indicating when isolates should be upgraded.

3. Custom properties: Any additional properties can be added and will be passed to the Proxy component.

### Usage in the System

1. In `api.ts`:
   - Adapters are loaded from the `functionsDir/adapters` path.
   - The adapter function is called with the current configuration.
   - The returned configuration is used to update the system behavior.

2. In the Proxy component:
   - Custom properties from the adapter are accessible in the `config` object.
   - These properties can be used to modify the behavior of isolates, routing, or any other aspect of request handling.

### Example Adapter

Here's a simple example of an adapter:

```typescript
export default async function adapter(config: any) {
  return {
    ...config,
    loaderConfig: {
      username: 'custom-loader',
      password: 'secret-password'
    },
    shouldUpgradeAfter: Date.now() + 3600000, // Upgrade after 1 hour
    customRouting: (url: string) => {
      // Custom routing logic
    },
    // Any other custom properties or functions
  };
}
```

### Benefits of Using Adapters

1. **Flexibility**: Easily modify system behavior without changing core components.
2. **Modularity**: Encapsulate project-specific configurations and behaviors.
3. **Dynamic Configuration**: Adapt the system behavior based on runtime conditions.
4. **Extension Points**: Provide hooks for adding custom functionality to various parts of the request lifecycle.

2. Custom loaders:
   - Implement custom file loaders by extending the base loader functionality

   The file-loader will parse the username string to determine the loader type and additional parameters. The password field can be used for authentication or as a secret key for the custom loader.

3. Middleware:
   - Define custom middleware functions to be executed before and after module execution

4. Isolate management:
   - Customize isolate creation, upgrading, and termination strategies by modifying the proxy logic

5. Module execution:
   - Implement custom module loaders and execution strategies

6. Caching:
   - Configure caching strategies for file content, isolate metadata, and execution results

## Conclusion

The Axion Framework provides a flexible and scalable architecture for building web applications. Its modular design, isolate-based execution model, and extensive configuration options allow developers to create efficient and secure server-side applications while maintaining the ability to customize and extend the framework's capabilities.