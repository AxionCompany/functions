import basicAuth from "./middlewares/basicAuth.ts";

import { config } from "https://deno.land/x/dotenv/mod.ts";

export default (adapters: any = undefined) => {

  const env = {  ...config(), ...adapters?.env };

  const connectors = {};

  const features = {};

  const middlewares = {
    basicAuth: basicAuth({
      validateAuth: (username: string, password: string) => {
        if (!env.USERNAME && !env.PASSWORD) return true;
        if ((username === env.USERNAME) && (password === env.PASSWORD)) {
          return { username, password };
        } else {
          throw new Error("Unauthorized");
        }
      },
    }),
  };
  
  const handlers = {
    ["rpc"]: async (adapters: any) => (await import('./handlers/rpc.ts')).default({ ...adapters, middlewares:{} }),
    ["file-loader"]: async (adapters: any) => (await import('./handlers/fileLoader.ts')).default({ ...adapters, middlewares }),
  };

  const ports = {
    ["deno-serve"]: async (adapters: any)=> (await import ('./ports/denoServe.ts')).default({...adapters, handlers}),
    ["cloudfare-workers"]: async (adapters: any)=>( await import('./ports/cloudfareWorkers.ts')).default({...adapters, handlers}),
  };

  return {
    env,
    connectors,
    features,
    handlers,
    ports,
  };
};
