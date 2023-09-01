import loadFile from "./functions/features/loadFile.ts";
import Adapters from "./functions/adapters.ts";

const remoteAdapters = Adapters();

// load local adapters
console.log("Loading local adapters...");
const LocalAdapters: any = await import("./functions/adapters.ts")
  .then((res) => res.default)
  .catch((err) => console.log("Error loading local adapters", err)) ||
  (() => {});
const localAdapters = LocalAdapters ? LocalAdapters(remoteAdapters) : {};
console.log("Local adapters loaded.");

const adapters: any = { ...remoteAdapters, ...localAdapters };

const { env } = adapters;

const PORT = Number(env["FILE_LOADER_PORT"] || env["PORT"] || 8000);

Deno.serve({ port: PORT }, async (req) => {
  const pathname: string = new URL(req.url).pathname;

  if (env.USERNAME || env.PASSWORD) {
    const auth = basicAuth(req, {
      username: env.USERNAME,
      password: env.PASSWORD,
    });
    if (auth !== true) {
      return auth;
    }
  }
  
  const res = await loadFile(adapters)({ pathname });
  return new Response(res, {
    headers: { "content-type": "text/plain" },
  });
});

const basicAuth = (
  req: Request,
  { username, password }: { username: string; password: string },
): any => {
  const authorization = req.headers.get("authorization");
  if (authorization) {
    const match = authorization.match(/^Basic\s+(.*)$/);
    if (match) {
      const [_username, _password] = atob(match[1]).split(":");
      if ((username === _username) && (password === _password)) {
        return true;
      }
    }
  }

  return new Response("401 Unauthorized", {
    status: 401,
    statusText: "Unauthorized",
    headers: {
      // "www-authenticate": `Basic realm="${realm}"`,
    },
  });
};
