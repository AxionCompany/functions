// Start Oxian API in development (worker isolates)
// Usage: deno run -A jsr:@oxian/oxian-js/dev/cluster

try { Deno.env.set('ENV', Deno.env.get('ENV') || 'development'); } catch {}
try { Deno.env.set('WATCH', Deno.env.get('WATCH') || 'true'); } catch {}
try { Deno.env.set('ISOLATE_TYPE', Deno.env.get('ISOLATE_TYPE') || 'worker'); } catch {}

await import(new URL('../api.ts', import.meta.url).href); 