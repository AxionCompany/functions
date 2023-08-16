import { assertEquals } from "https://deno.land/std@0.197.0/assert/mod.ts";

Deno.test(async function Test(){
  const mod = await import("http://localhost:8000/teste.js?");
  console.log(mod.default())
  assertEquals(mod.default(), "Hello World!");
});
