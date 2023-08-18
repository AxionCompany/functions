import functionExec from "./functions/function-exec.ts?v=3";
import { config } from "https://deno.land/x/dotenv/mod.ts";

const env = { ...Deno.env.toObject(), ...config() };
const PORT = Number(env["API_PORT"] || env["PORT"] || 8001);
let v: any = {};

Deno.serve({ port: PORT }, async (req) => {
  try {
    const pathname = new URL(req.url).pathname;
    const body = await req.json().then((res) => res).catch((err) => ({}));
    const params: any = { ...body };
    new URL(req.url).searchParams.forEach((value, key) => params[key] = value);
    const res: any = await functionExec({ env })({ pathname, params, v });
    return new Response(JSON.stringify(res),{headers: {'Content-Type': 'application/json'}});
  } catch (err) {
    console.log(err);
    return new Response(err);
  }
});
