# Isolate V2 Improvements

## Overview

The isolate-v2 system has been significantly improved to support isomorphic execution, better type safety, and more flexible configuration management.

## Key Improvements

### 1. Isomorphic Isolate Execution

The isolate can now run in two modes:
- **Direct Mode**: Running standalone with environment variables
- **Proxy Mode**: Running through the proxy with header-based communication

### 2. Environment-Based Configuration

Instead of relying on query parameters, the isolate now uses environment variables for configuration:

```bash
# Core configuration
PORT=9000
PROJECT_ID=my-project
PROJECT_PATH=/path/to/project
ISOLATE_ID=my-isolate

# Import configuration
IMPORT_URL=https://example.com/functions/user.ts
IMPORT_PATH=/functions/user.ts  # Alternative to IMPORT_URL
LOADER_URL=https://loader.example.com

# Database configuration
DATABASE_ENABLED=true
DATABASE_URL=file:///path/to/db.sqlite
DATABASE_LWW_COLUMN=updated_at
DATABASE_EDGE_ID=my-edge

# File loader configuration
FILE_LOADER_TYPE=local
FILE_LOADER_DEBUG=true
FILE_LOADER_USE_CACHE=true
FILE_LOADER_BUST_CACHE=false
FILE_LOADER_ENVIRONMENT=production
FILE_LOADER_DIR_ENTRYPOINT=index

# Deno configuration (JSON strings)
DENO_IMPORTS='{"@std/": "jsr:@std/"}'
DENO_SCOPES='{"jsr.io": {"@std/": "jsr:@std/"}}'
```

### 3. Header-Based Proxy Communication

When running through the proxy, communication is now done via headers instead of query parameters:

```typescript
// Headers set by proxy
'x-import-url': 'https://example.com/functions/user.ts'
'x-proxy-url': 'https://api.example.com/users/123'
'x-isolate-id': 'my-isolate'
'x-project-id': 'my-project'
```

### 4. Custom Loader Integration

The system now integrates with the file-loader logic when no HTTP loader exists:

- **HTTP Loader**: Uses the configured `LOADER_URL` to fetch files
- **Local Loader**: Falls back to local file system using file-loader logic
- **Custom Bundle Loader**: Integrates with Deno's bundle function for in-process loading

### 5. Enhanced Type Safety

All configuration objects now have proper TypeScript interfaces:

```typescript
interface IsolateConfig {
  // Core isolate properties
  projectId: string;
  projectPath: string;
  isolateId?: string;
  
  // Environment and request context
  env: Record<string, string>;
  url?: string;
  headers?: Headers;
  
  // Import URL configuration
  importUrl?: string;
  loaderUrl?: string;
  
  // Database configuration
  database?: DatabaseConfig;
  
  // File loader configuration
  fileLoader?: FileLoaderConfig;
  
  // Deno configuration for bundling
  denoConfig?: {
    imports?: Record<string, string>;
    scopes?: Record<string, Record<string, string>>;
  };
  
  // ... other properties
}
```

## Usage Examples

### Running Directly

```bash
# Set environment variables
export PORT=9000
export PROJECT_ID=my-project
export PROJECT_PATH=/path/to/project
export IMPORT_URL=/functions/user.ts

# Run the isolate
deno run -A functions/src/isolate-v2/main.ts
```

### Running Through Proxy

The proxy automatically manages isolate lifecycle and sets appropriate headers:

```typescript
// Proxy automatically:
// 1. Creates isolate if not exists
// 2. Sets headers for communication
// 3. Forwards requests to isolate
// 4. Manages isolate lifecycle
```

### Custom Loader Example

When no HTTP loader is available, the system uses a custom loader:

```typescript
// Custom loader function for Deno's bundle function
async function createCustomLoader(config: IsolateConfig) {
  return async (specifier: string) => {
    // Try HTTP loader first
    if (config.loaderUrl) {
      const response = await fetch(new URL(specifier, config.loaderUrl));
      if (response.ok) {
        return {
          kind: "module",
          specifier,
          source: await response.text()
        };
      }
    }
    
    // Fallback to local file system
    const filePath = `${config.projectPath}/${specifier}`;
    const source = await Deno.readTextFile(filePath);
    return {
      kind: "module",
      specifier,
      source
    };
  };
}
```

## Benefits

1. **Better Developer Experience**: Clear type definitions and error messages
2. **Flexible Deployment**: Can run standalone or through proxy
3. **Improved Performance**: Custom loader reduces HTTP overhead
4. **Better Security**: Headers instead of query parameters for sensitive data
5. **Environment Agnostic**: Works in any environment with proper configuration

## Migration Guide

### From Query Parameters to Headers

**Before:**
```typescript
const importUrl = atob(__importUrl__);
const url = atob(__proxyUrl__);
```

**After:**
```typescript
let importUrl = this.config.importUrl;
if (rawRequestData.headers['x-import-url']) {
  importUrl = rawRequestData.headers['x-import-url'];
}
```

### From Hardcoded Config to Environment Variables

**Before:**
```typescript
const config = JSON.parse(configString);
```

**After:**
```typescript
const config = {
  projectId: Deno.env.get('PROJECT_ID') || 'default',
  projectPath: Deno.env.get('PROJECT_PATH') || Deno.cwd(),
  // ... other environment-based config
};
```

## Future Enhancements

1. **Dynamic Configuration**: Support for runtime configuration updates
2. **Load Balancing**: Multiple isolate instances for high availability
3. **Metrics Collection**: Performance and usage metrics
4. **Plugin System**: Extensible loader and processor plugins 