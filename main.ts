 /// <reference lib="deno.unstable" />
 
import Adapters from "./functions/adapters.ts";

const { ports, ...adapters }: any = Adapters(null);

const server = await ports[adapters.env.SERVER_PORT || "deno-serve"](adapters);

export default server
