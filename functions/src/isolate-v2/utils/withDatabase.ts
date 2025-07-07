
import { Ominipg } from "jsr:@oxian/ominipg@0.0.6";

// Basic dependency structure, can be extended if needed
export interface Dependencies {
    [key: string]: any;
}

export interface DatabaseConfig {
    syncUrl?: string;
    url?: string;
    lwwColumn?: string;
    edgeId?: string;
    enabled: boolean;
    schemaSQL?: string[];
}

export interface DatabaseDependencies extends Dependencies {
    db?: any; // The Ominipg client
    schema?: Record<string, any>;
    dbConfig?: DatabaseConfig;
}

export interface WithDatabaseConfig {
    database?: DatabaseConfig;
    projectPath: string;
    isolateId: string;
    loaderUrl?: string;
    schemaSQL?: string[];
}

/**
 * Establishes a database connection and returns it as part of the dependencies.
 * This is a simplified version that assumes the schema is provided or not needed.
 */
export async function withDatabase(
    dependencies: Dependencies,
    config: WithDatabaseConfig
): Promise<DatabaseDependencies> {
    if (!config.database?.enabled) {
        return dependencies;
    }

    const dbConfig: DatabaseConfig = {
        ...config.database,
        lwwColumn: config.database.lwwColumn || 'updated_at',
        edgeId: config.database.edgeId || `${config.isolateId}_${crypto.randomUUID().slice(0, 8)}`,
        enabled: true,
        schemaSQL: config.schemaSQL || [],
    };

    const url: string = dbConfig.url || `file://${config.projectPath}/db/isolate_${config.isolateId}.db`;

    // Ensure the directory for a file-based DB exists.
    if (url.startsWith('file://')) {
        const dbPath = url.replace('file://', '');
        const dirPath = dbPath.substring(0, dbPath.lastIndexOf('/'));
        await Deno.mkdir(dirPath, { recursive: true });
    }

    try {
        const db = await Ominipg.connect({
            ...dbConfig,
            url: url,
            // In this version, we assume schema objects are not dynamically loaded.
            // They would need to be passed in `dependencies` if required.
            schema: dependencies.schema
        });

        console.log(`[IsolateV2] Database connection established for isolate ${config.isolateId}`);

        return {
            ...dependencies,
            db,
            dbConfig,
            schema: dependencies.schema
        };
    } catch (error) {
        console.error(`[IsolateV2] Failed to connect to database for isolate ${config.isolateId}:`, error);
        throw error;
    }
}

/**
 * Gracefully closes the database connection.
 */
export async function cleanupDatabase(dependencies: DatabaseDependencies): Promise<void> {
    if (dependencies.db) {
        try {
            await dependencies.db.close();
            console.log("[IsolateV2] Database connection closed.");
        } catch (error) {
            console.error("[IsolateV2] Error during database cleanup:", error);
        }
    }
} 