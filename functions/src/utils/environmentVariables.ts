import { load } from "jsr:@std/dotenv";

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