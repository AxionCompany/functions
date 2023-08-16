import { load } from "https://deno.land/std/dotenv/mod.ts";
import functionExec from "./functions/function-exec.ts";

const env = await load();
const PORT = Number(env["API_PORT"] || env["PORT"] || 8001);
let v: any = {};

Deno.serve({ port: PORT }, async (req) => {
  try {
    const pathname = new URL(req.url).pathname;
    const body = await req.json();
    const params: any = {};
    new URL(req.url).searchParams.forEach((value, key) => {
      params[key] = value;
    });
    const res: any = await functionExec({ env })({ pathname, params: {...params, ...body}, v });
    return new Response(res);
  } catch (err) {
    console.log(err);
    return new Response(err);
  }
});
