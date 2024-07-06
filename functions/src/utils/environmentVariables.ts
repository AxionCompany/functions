import { config } from "https://deno.land/x/dotenv/mod.ts";

export default function getEnv() {

    let dotEnv;

    try {
        dotEnv = config();
    } catch (err) {
        console.log(err);
        dotEnv = {};
    }

    const env = { ...dotEnv, ...Deno.env.toObject() };
    return env
}