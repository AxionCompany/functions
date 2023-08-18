import { config } from "https://deno.land/x/dotenv/mod.ts";

import functionExec from "./functions/function-exec.ts";
import createAdapters from "./functions/create-adapters.ts?v=2";

const env = { ...Deno.env.toObject(), ...config() };
const PORT = Number(env["API_PORT"] || env["PORT"] || 8001);
let v: any = {};

const adapters: any = await import(env.ADAPTERS_URL)
  .then(adaptersConfig=>createAdapters({ env })(adaptersConfig.default))
  .catch((err) => {
    console.log(err)
    console.log("No adapters.ts file found... Skipping adapters creation");
    return { env };
  });

Deno.serve({ port: PORT }, async (req) => {
  try {
    const pathname = new URL(req.url).pathname;
    const body = await req.json().then((res) => res).catch((err) => ({}));
    const params: any = { ...body };
    new URL(req.url).searchParams.forEach((value, key) => params[key] = value);
    const res: any = await functionExec({ pathname, params, v, env });
    return new Response(res);
  } catch (err) {
    console.log(err);
    return new Response(err);
  }
});
