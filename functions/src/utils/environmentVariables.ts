import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

export default async function getEnv() {

    let dotEnv;

    try {
        dotEnv = await load();
    } catch (err) {
        console.log(err);
        dotEnv = {};
    }

    const env = { ...dotEnv, ...Deno.env.toObject() };
    return env
}