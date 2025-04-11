# Axion File Loader Examples

This directory contains examples showcasing the power and flexibility of the Axion File Loader as a standalone library.

## Serverless API Architecture

The examples demonstrate how to use the Axion File Loader to create a powerful file-based API routing system similar to Next.js or Vercel's serverless functions. The architecture consists of two separate servers:

1. **File Loader Server** (`file-loader.ts`): The existing Axion File Loader server that serves files from the local filesystem or GitHub repositories.
2. **API Server** (`api-server.ts`): A server that uses the File Loader to dynamically load and execute API handlers.

This separation of concerns allows for a more flexible and scalable architecture, where the file loader can be deployed as a separate service.

### Features

- **File-based Routing**: API endpoints are defined by their file paths
- **Dynamic Routes**: Support for path parameters using bracket notation (e.g., `[id].ts`)
- **HTTP Method Handlers**: Define different handlers for GET, POST, PUT, DELETE, etc.
- **Environment Variables**: Automatic injection of environment variables into handlers
- **Multiple Loaders**: Support for loading files from local filesystem or GitHub repositories
- **Direct HTTP Imports**: Uses Deno's ability to import modules directly via HTTP URLs
- **Caching**: Built-in caching for improved performance

### Directory Structure

```
examples/
├── api/                      # API handler files
│   ├── index.ts              # GET /api
│   ├── health.ts             # GET /api/health
│   └── users/
│       ├── index.ts          # GET, POST /api/users
│       └── [id].ts           # GET, PUT, DELETE /api/users/:id
└── api-server.ts             # API server that uses the file loader
```

## Running the Examples

### Step 1: Start the File Loader Server

First, start the Axion File Loader server to serve files from the local filesystem:

```bash
deno run --allow-net --allow-read --allow-env file-loader.ts
```

This will start the file loader server on port 3000 by default.

To use GitHub as the file source, you can set up authentication in the request headers when accessing the file loader server.

### Step 2: Start the API Server

Next, start the API server that will use the file loader to serve API endpoints:

```bash
deno run --allow-net --allow-read --allow-env examples/api-server.ts
```

This will start the API server on port 8000 by default, connecting to the file loader server at http://localhost:3000.

To specify a different file loader URL:

```bash
deno run --allow-net --allow-read --allow-env examples/api-server.ts \
  --file-loader-url=http://your-file-loader-server:3000
```

### API Endpoints

Once both servers are running, you can access the following endpoints:

- `GET /api` - Returns API information
- `GET /api/health` - Returns system health information
- `GET /api/users` - Returns a list of users (supports pagination and filtering)
- `POST /api/users` - Creates a new user
- `GET /api/users/:id` - Returns a specific user by ID
- `PUT /api/users/:id` - Updates a specific user
- `DELETE /api/users/:id` - Deletes a specific user

### Example Requests

#### Get API Information

```bash
curl http://localhost:8000/api
```

#### Get Health Information

```bash
curl http://localhost:8000/api/health
```

#### List Users

```bash
curl http://localhost:8000/api/users
```

With pagination:

```bash
curl http://localhost:8000/api/users?page=1&limit=2
```

With filtering:

```bash
curl http://localhost:8000/api/users?role=admin
```

#### Get User by ID

```bash
curl http://localhost:8000/api/users/1
```

#### Create User

```bash
curl -X POST http://localhost:8000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com","role":"user"}'
```

#### Update User

```bash
curl -X PUT http://localhost:8000/api/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice Updated"}'
```

#### Delete User

```bash
curl -X DELETE http://localhost:8000/api/users/1
```

## How It Works

The architecture works as follows:

1. **File Loader Server** (`file-loader.ts`):
   - Receives requests for files
   - Uses the Axion File Loader to find matching files
   - Serves files with appropriate content types
   - Returns JSON when requested with the Accept header

2. **API Server**:
   - Receives API requests
   - Fetches file metadata from the File Loader Server using JSON format
   - Imports the module directly via HTTP using Deno's dynamic import capability
   - Calls the appropriate handler based on the HTTP method
   - Returns the handler's response

This approach leverages Deno's ability to import modules directly via HTTP URLs, eliminating the need to create temporary files or compile code on the fly. The separation of concerns allows for:

- Independent scaling of file loading and API execution
- Different deployment strategies for each component
- Easier maintenance and updates
- Better resource utilization

## Extending the Example

You can extend this example in several ways:

1. **Add Middleware**: Implement authentication, logging, or other middleware
2. **Database Integration**: Connect to a database for persistent storage
3. **File Uploads**: Add support for file uploads and storage
4. **WebSockets**: Implement real-time communication with WebSockets
5. **Custom Loaders**: Create custom loaders for other file sources
6. **Distributed Deployment**: Deploy the file loader and API servers on different machines

## Using in Production

While this example is primarily for demonstration purposes, it can be adapted for production use with some additional considerations:

1. **Error Handling**: Add more robust error handling and logging
2. **Security**: Implement proper authentication and authorization
3. **Rate Limiting**: Add rate limiting to prevent abuse
4. **Monitoring**: Add metrics and monitoring
5. **Caching**: Implement more sophisticated caching strategies
6. **Load Balancing**: Set up load balancing for both servers
7. **HTTPS**: Configure HTTPS for secure communication

## Learn More

To learn more about the Axion File Loader and how to use it in your projects, check out the main documentation in the repository. 