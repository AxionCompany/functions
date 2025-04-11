// Wrapper for esbuild web worker
import { logDebug, logError } from "../../../utils/logger.ts";

// Store the worker instance
let worker = null;
// Store pending requests
const pendingRequests = new Map();

// Generate a unique request ID
function generateRequestId() {
  return crypto.randomUUID();
}

// Initialize the web worker
function initWorker() {
  if (worker) return;
  
  // Create a new worker
  const workerUrl = new URL('./esbuild-worker.js', import.meta.url);
  worker = new Worker(workerUrl, { type: 'module' });
  
  // Handle messages from the worker
  worker.onmessage = (event) => {
    const { id, success, result, error } = event.data;
    
    // Find the pending request
    const pendingRequest = pendingRequests.get(id);
    if (!pendingRequest) {
      logError(`No pending request found for ID: ${id}`);
      return;
    }
    
    // Resolve or reject the pending promise
    const { resolve, reject } = pendingRequest;
    pendingRequests.delete(id);
    
    if (success) {
      resolve(result);
    } else {
      reject(new Error(error));
    }
  };
  
  // Handle worker errors
  worker.onerror = (error) => {
    logError("Web worker error:", error);
    
    // Reject all pending requests
    for (const [id, { reject }] of pendingRequests.entries()) {
      reject(new Error("Worker error: " + (error.message || "Unknown error")));
      pendingRequests.delete(id);
    }
    
    // Reset the worker
    worker = null;
  };
}

// Terminate the worker and clean up resources
export function terminateWorker() {
  if (!worker) return;
  
  logDebug("Terminating esbuild worker");
  
  // Reject all pending requests
  for (const [id, { reject }] of pendingRequests.entries()) {
    reject(new Error("Worker terminated"));
    pendingRequests.delete(id);
  }
  
  // Terminate the worker
  worker.terminate();
  worker = null;
}

// Export the bundling function that communicates with the worker
export default async (path, { ...options } = {}) => {
  // Initialize worker if needed
  initWorker();
  
  // Generate request ID
  const requestId = generateRequestId();
  
  // Create promise for this request
  const promise = new Promise((resolve, reject) => {
    pendingRequests.set(requestId, { resolve, reject });
  });
  
  // Send message to worker
  worker.postMessage({
    id: requestId,
    path,
    options
  });
  
  // Add timeout to prevent hanging requests
  const timeout = setTimeout(() => {
    if (pendingRequests.has(requestId)) {
      const pendingRequest = pendingRequests.get(requestId);
      pendingRequests.delete(requestId);
      logError("Bundling request timed out");
      pendingRequest.reject(new Error("Bundling timed out"));
    }
  }, 30000); // 30 second timeout
  
  try {
    // Wait for worker response
    const result = await promise;
    clearTimeout(timeout);
    return result;
  } catch (error) {
    clearTimeout(timeout);
    logError("Error in bundling:", error.message);
    throw error;
  }
};

