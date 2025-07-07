import { Ominipg } from "jsr:@oxian/ominipg@0.0.6";
import getAllFiles from "./getAllFiles.ts";
import { Dependencies } from "../main.ts";
import { dynamicImportBundledModules } from "./moduleLoader.ts";

export interface DatabaseConfig {
  /** Remote PostgreSQL database URL */
  syncUrl?: string;
  /** PostgreSQL database URL (file:// for PGlite, postgres:// for PostgreSQL) */
  url?: string;
  /** Last-write-wins timestamp column name */
  lwwColumn?: string;
  /** Edge instance identifier */
  edgeId?: string;
  /** Enable database for this isolate */
  enabled: boolean;
  /** Initial DDL statements */
  schemaSQL?: string[];
}

export interface DatabaseDependencies extends Dependencies {
  /** Type-safe Drizzle database client */
  db?: any;
  /** Raw database worker for advanced operations */
  dbWorker?: Worker;
  /** Loaded schema exports (tables, utilities, etc.) */
  schema?: Record<string, any>;
  /** Database configuration */
  dbConfig?: DatabaseConfig;
}

export interface WithDatabaseConfig {
  /** Database configuration */
  database?: DatabaseConfig;
  /** Project root path for loading schemas */
  projectPath: string;
  /** Isolate ID for generating unique database paths */
  isolateId: string;
  /** File loader base URL */
  loaderUrl?: string;
  /** Bust cache for all bundled modules */
  bustCache?: boolean;
}

/**
 * Load schema files dynamically using the same pattern as moduleLoader
 */
async function loadSchemas(
  config: WithDatabaseConfig,
  dependencies: Dependencies
): Promise<{
  schemaSQL: string[];
  schemaExports: Record<string, any>;
}> {
  let schemaSQL: string[] = [];
  let schemaExports: Record<string, any> = {};

  try {
    // Use the same file loading pattern as moduleLoader.ts
    const baseUrl = new URL(config.loaderUrl || `http://localhost:9000`).origin;
    const importUrlObj = new URL(baseUrl);

    // Get schema files using getAllFiles (same as moduleLoader)
    const schemaFiles = await getAllFiles({
      url: baseUrl,
      name: "schema",
      extensions: ["js", "ts"],
    });

    const importMap = dependencies?.denoConfig?.imports
      ? {
        imports: dependencies.denoConfig.imports,
        scopes: dependencies.denoConfig.scopes || {},
      }
      : undefined;

    const schemaModules = await dynamicImportBundledModules(
      schemaFiles,
      "Schema",
      baseUrl,
      importUrlObj.search,
      importMap,
      config.bustCache,
      false // returnDefault = false
    );

    // Load and process each schema file
    for (const schemaModule of schemaModules) {
      if (!schemaModule) continue;
      try {
        // Collect DDL statements
        if (schemaModule.schemaDDL && Array.isArray(schemaModule.schemaDDL)) {
          schemaSQL.push(...schemaModule.schemaDDL);
        }

        // Collect all exports except schemaDDL
        Object.keys(schemaModule).forEach((key) => {
          if (key !== "schemaDDL" && key !== "default") {
            schemaExports[key] = schemaModule[key];
          }
        });

        // Also include default export if it exists
        if (schemaModule.default) {
          Object.assign(schemaExports, schemaModule.default);
        }
      } catch (error) {
        console.warn(
          `[Schema Loader] Failed to process schema module:`,
          error
        );
      }
    }
  } catch (error) {
    console.warn(
      "[Schema Loader] Schema loading failed, using empty schema:",
      error
    );
  }

  return { schemaSQL, schemaExports };
}

/**
 * Add database capabilities to isolate dependencies
 */
export async function withDatabase(
  dependencies: Dependencies,
  config: WithDatabaseConfig
): Promise<DatabaseDependencies> {
  // If no database config provided or disabled, return dependencies as-is
  if (!config.database?.enabled) {
    return dependencies;
  }

  // Load schemas dynamically
  const { schemaSQL, schemaExports } = await loadSchemas(config, dependencies);

  // Configure database with loaded schemas
  const dbConfig: DatabaseConfig = {
    url: config.database.url,
    syncUrl: config.database.syncUrl,
    lwwColumn: config.database.lwwColumn || 'updated_at',
    edgeId: config.database.edgeId || `${config.isolateId}_${crypto.randomUUID().slice(0, 8)}`,
    enabled: true,
    schemaSQL
  };

  // Determine main database URL and optional sync URL
  const url: string = dbConfig.url || `file://${config.projectPath}/db/isolate_${config.isolateId}.db`;
  const syncUrl: string | undefined = dbConfig.syncUrl;

  // ensure the file:// url is a valid dir
  const ensureDir = async (path: string) => {
    try {
      const stat = await Deno.stat(path);
      if (!stat?.isDirectory) {
        throw new Error(`${path} exists but is not a directory`);
      }
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        await Deno.mkdir(path, { recursive: true });
      } else {
        throw err;
      }
    }
  }

  if (url.startsWith('file://')) {
    await ensureDir(url.replace('file://', ''));
  }

  // Create type-safe Drizzle client
  let db;
  try {
    db = await Ominipg.connect({
      ...dbConfig,
      url: url,
      syncUrl: syncUrl,
      schema: schemaExports
    })


    // Test the database connection and schema
    try {
      const testResult = await db.queryRaw('SELECT tablename FROM pg_tables WHERE schemaname = $1', ['public']);
      console.log(`[Database] Found ${testResult.rows.length} user tables in database for isolate ${config.isolateId}`);
    } catch (testError) {
      console.warn(`[Database] Could not list tables:`, testError);
    }

  } catch (error) {
    console.error(`[Database] Failed to create Drizzle client for isolate ${config.isolateId}:`, error);
    throw error;
  }

  // Return enhanced dependencies
  return {
    ...dependencies,
    db,
    schema: schemaExports,
    dbConfig
  };
}

/**
 * Cleanup database resources
 */
export async function cleanupDatabase(dependencies: DatabaseDependencies): Promise<void> {
  if (dependencies.db) {
    try {
      await dependencies.db.close();
    } catch (error) {
      console.error('[Database] Error during database cleanup:', error);
    }
  }
} 