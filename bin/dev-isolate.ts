// Start Oxian API in development (subprocess isolates)
// Usage: deno run -A jsr:@oxian/oxian-js/dev/isolate

try { Deno.env.set('ENV', Deno.env.get('ENV') || 'development'); } catch {}
try { Deno.env.set('WATCH', Deno.env.get('WATCH') || 'true'); } catch {}

await import(new URL('../functions/src/isolate-v2/main.ts', import.meta.url).href); 