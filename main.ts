import Adapters from "./functions/adapters.ts";

const { ports, ...adapters }: any = Adapters(null);

ports[adapters.env.SERVER_PORT || "deno-serve"](adapters);
