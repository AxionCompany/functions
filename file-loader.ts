import fileLoader from "./functions/file-loader.ts?v=2";
import { config } from "https://deno.land/x/dotenv/mod.ts";

const env = { ...Deno.env.toObject(), ...config() };

const PORT = Number(env["FILE_LOADER_PORT"] || env["PORT"] || 8000);

Deno.serve({ port: PORT }, async (req) => {
  const pathname = new URL(req.url).pathname;
  const url = new URL(req.url).href;
  const token: string = new URL(req.url).searchParams.get("token") || "";
  const res = await fileLoader({ env })({ pathname, url, token });
  return new Response(res, {
    headers: { "content-type": "text/plain" },
  });
});
