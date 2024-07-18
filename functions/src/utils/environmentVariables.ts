// import { config } from "https://deno.land/x/dotenv/mod.ts";
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";


export default async function getEnv() {

    let dotEnv;

    try {
        // dotEnv = config();
        dotEnv = await load();
    } catch (err) {
        console.log(err);
        dotEnv = {};
    }

    const env = { ...dotEnv, ...Deno.env.toObject() };
    return env
}