# Database Integration for Oxian.js Isolates

This document explains how to use the database functionality in Oxian.js isolates, which provides flexible PostgreSQL storage with multiple deployment modes.

## Overview

Each isolate can optionally have its own database instance that supports three distinct modes:

- **Local-first with sync**: PGlite (local) + PostgreSQL (remote sync)
- **Remote-only**: Direct PostgreSQL connection (stateless)
- **Local-only**: PGlite without remote sync (testing/development)

The system automatically detects the database type based on URL prefixes and provides:
- **Conflict resolution** using last-write-wins timestamps
- **Automatic schema management** and sync triggers
- **Clean isolation** between different isolates
- **Connection resilience** and offline capabilities (local modes)

## Database Modes

### 1. Local-first with Sync

```typescript
const config = {
  enabled: true,
  localPath: "file://./db/my_app.db",     // PGlite local database
  remoteURL: "postgres://user:pass@remote/db", // PostgreSQL for sync
  lwwColumn: "updated_at"
};
```

**Best for**: Edge functions, offline-capable apps, reduced latency
- ✅ Works offline
- ✅ Fast local queries
- ✅ Automatic bidirectional sync
- ✅ Conflict resolution

### 2. Remote-only

```typescript
const config = {
  enabled: true,
  // No localPath = direct remote connection
  remoteURL: "postgres://user:pass@remote/db", // Direct PostgreSQL
  lwwColumn: "updated_at"
};
```

**Best for**: Stateless functions, serverless environments, simple deployments
- ✅ No local storage needed
- ✅ Always up-to-date data
- ✅ Simpler deployment
- ❌ Requires network for all queries

### 3. Local-only

```typescript
const config = {
  enabled: true,
  localPath: "file://./db/test.db",       // PGlite local database
  // No remoteURL = no sync
  lwwColumn: "updated_at"
};
```

**Best for**: Development, testing, demos, offline apps
- ✅ No remote dependencies
- ✅ Fast and simple
- ✅ Perfect for testing
- ❌ No data persistence across deployments

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│     Isolate     │    │   DB Worker      │    │   Database      │
│                 │    │                  │    │                 │
│  Your Function  │◄──►│  Auto-detected:  │◄──►│  PGlite (local) │
│                 │    │  - PGlite        │    │  PostgreSQL     │
│  db.query(...)  │    │  - PostgreSQL    │    │  (remote)       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

The worker automatically detects database type:
- `file://` URLs → PGlite (in-process SQLite-compatible PostgreSQL)
- `postgres://` URLs → PostgreSQL (standard connection pool)

## Quick Start

### 1. Configure Database Mode

In your database adapter (`functions/adapters.ts`):

```typescript
// Example: Different modes for different environments
function getDatabaseConfig(isolateId: string, env: Record<string, string>) {
  // Development: Local-first with sync
  if (env.ENV === 'development') {
    return {
      enabled: true,
      localPath: `file://./db/${isolateId}.db`,
      remoteURL: env.DEV_DATABASE_URL,
      lwwColumn: 'updated_at'
    };
  }
  
  // Production: Remote-only for stateless deployment
  if (env.ENV === 'production') {
    return {
      enabled: true,
      remoteURL: env.PROD_DATABASE_URL,
      lwwColumn: 'updated_at'
    };
  }
  
  // Testing: Local-only
  return {
    enabled: true,
    localPath: `file://./test_db/${isolateId}.db`,
    lwwColumn: 'updated_at'
  };
}
```

### 2. Use Database in Functions

```typescript
export default async function handler(req: Request, { db }: { db: any }) {
  // Works the same regardless of database mode!
  
  // Insert data
  const post = await db.insert(posts).values({
    title: "Hello World",
    content: "This works with any database mode!",
    updated_at: new Date()
  }).returning();
  
  // Query data
  const allPosts = await db.select().from(posts).where(eq(posts.published, true));
  
  // Manual sync (only relevant for local-first mode)
  const syncResult = await db.sync();
  console.log(`Synced ${syncResult.pushed} changes`);
  
  return Response.json({ posts: allPosts, created: post[0] });
}
```

## Environment Variables

```bash
# Development (local-first + sync)
ENV=development
DEV_DATABASE_URL=postgresql://user:pass@localhost:5432/myapp_dev

# Production (remote-only)
ENV=production
PROD_DATABASE_URL=postgresql://user:pass@prod-server:5432/myapp

# Testing (local-only)
ENV=test
LOCAL_ONLY=true

# Debug mode
DEBUG=true
```

## Schema Management

Schemas work the same across all modes:

```typescript
// Define your schema (functions/schemas/blog.sql)
CREATE TABLE IF NOT EXISTS posts (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()  -- LWW column for sync
);

// Drizzle schema (functions/schemas/blog.ts)
export const posts = pgTable('posts', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  title: text('title').notNull(),
  content: text('content'),
  published: boolean('published').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});
```

## Migration Guide

### From Legacy API

Old code:
```typescript
worker.postMessage({
  type: "init",
  localURL: "file://edge.db",
  remoteURL: "postgres://...",
  schemaSQL: [...]
});
```

New code:
```typescript
worker.postMessage({
  type: "init",
  url: "file://edge.db",        // Main database
  syncUrl: "postgres://...",     // Optional sync target
  schemaSQL: [...]
});
```

The old API is still supported for backward compatibility.

## Performance Characteristics

| Mode | Query Latency | Offline Support | Setup Complexity | Resource Usage |
|------|---------------|-----------------|------------------|----------------|
| Local-first + Sync | ~1ms | ✅ Full | Medium | Higher (dual databases) |
| Remote-only | ~10-100ms | ❌ None | Low | Lower (single connection) |
| Local-only | ~1ms | ✅ Full | Very Low | Lowest (no network) |

## Advanced Features

### Manual Sync Control

```typescript
// Force sync (local-first mode only)
const result = await db.sync();
console.log(`Pushed ${result.pushed} changes to remote`);

// Sync sequences after bulk operations
await db.worker.postMessage({ type: 'sync-sequences' });
```

### Diagnostics

```typescript
// Get detailed database state
const info = await db.diagnostic();
console.log(info.mainDatabase.type); // 'pglite' or 'postgres'
console.log(info.outbox.totalCount); // Pending sync changes
console.log(info.syncDatabase.hasReplication); // Replication status
```

### Raw SQL Access

```typescript
// Execute raw SQL when needed
const result = await db.raw({
  sql: 'SELECT * FROM posts WHERE created_at > $1',
  params: [new Date('2024-01-01')]
});
```

## Best Practices

### 1. Choose the Right Mode

- **Edge/Mobile apps**: Local-first with sync
- **Serverless functions**: Remote-only
- **Development/Testing**: Local-only
- **High-traffic APIs**: Remote-only with connection pooling

### 2. Schema Design

```sql
-- Always include updated_at for conflict resolution
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()  -- Required for sync
);

-- Use proper indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_updated ON users(updated_at);
```

### 3. Error Handling

```typescript
try {
  const result = await db.insert(posts).values(newPost);
  return Response.json({ success: true, post: result[0] });
} catch (error) {
  // Local-first mode can work offline, remote-only needs network
  if (error.message.includes('network') && db.diagnostic) {
    const info = await db.diagnostic();
    if (info.mainDatabase.type === 'pglite') {
      // Data saved locally, will sync later
      return Response.json({ success: true, offline: true });
    }
  }
  throw error;
}
```

### 4. Monitoring

```typescript
// Set up periodic diagnostics
setInterval(async () => {
  const info = await db.diagnostic();
  if (info.outbox.totalCount > 100) {
    console.warn('Sync backlog detected:', info.outbox.totalCount);
  }
}, 30000);
```

## Troubleshooting

### Common Issues

1. **Sync not working**: Check `db.diagnostic()` for replication status
2. **Schema mismatches**: Ensure same schema on local and remote
3. **Permission errors**: Verify PostgreSQL user has replication permissions
4. **Connection timeouts**: Check network connectivity for remote-only mode

### Debug Mode

```bash
DEBUG=true npm start
```

Shows detailed logs:
```
[Database] Configuring database for isolate api_posts:
[Database] Mode: local-first + sync
[Database] Main database: file://./db/api_posts.db
[Database] Sync database: postgres://user:pass@remote/db
[Database] Found 3 user tables in database
``` 