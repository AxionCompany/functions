// Start Oxian API in production (subprocess isolates)
// Usage: deno run -A jsr:@oxian/oxian-js/start/isolate

// Set defaults if not already provided
try { Deno.env.set('ENV', Deno.env.get('ENV') || 'production'); } catch {}

await import(new URL('../functions/src/isolate-v2/main.ts', import.meta.url).href); 