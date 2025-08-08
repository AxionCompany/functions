// Start Oxian API in production (worker isolates)
// Usage: deno run -A jsr:@oxian/oxian-js/start/cluster

try { Deno.env.set('ENV', Deno.env.get('ENV') || 'production'); } catch {}
try { Deno.env.set('ISOLATE_TYPE', Deno.env.get('ISOLATE_TYPE') || 'worker'); } catch {}

await import(new URL('../api.ts', import.meta.url).href); 