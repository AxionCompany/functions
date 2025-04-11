/**
 * Health Check API Endpoint
 * 
 * This endpoint provides system health information and demonstrates
 * how environment variables are injected into the API handlers.
 */

/**
 * GET handler for health check
 */
export function get(context: any) {
  const { env } = context;
  
  // Get current system information
  const memory = Deno.memoryUsage();
  
  return {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: performance.now() / 1000,
    environment: env.ENV || "development",
    system: {
      memory: {
        rss: formatBytes(memory.rss),
        heapTotal: formatBytes(memory.heapTotal),
        heapUsed: formatBytes(memory.heapUsed),
        external: formatBytes(memory.external),
      },
      runtime: {
        name: "Deno",
        version: Deno.version.deno,
        v8: Deno.version.v8,
        typescript: Deno.version.typescript,
      },
    },
    config: {
      // Show some environment variables (be careful not to expose secrets)
      debug: env.DEBUG === "true",
      region: env.REGION || "unknown",
      apiVersion: env.API_VERSION || "1.0.0",
    },
  };
}

/**
 * Formats bytes into a human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
} 