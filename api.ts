import functionExec from "./functions/features/executeFunction.ts";
import Adapters from "./functions/adapters.ts";

const remoteAdapters = Adapters();

let v: any = {};

console.log("Loading local adapters...");
const LocalAdapters = await remoteAdapters.moduleLoader({
  pathname: ("adapters"),
})
  .then((res) => res.default)
  .catch((err) => console.log("Error loading local adapters", err));

const localAdapters = LocalAdapters ? LocalAdapters(remoteAdapters) : {};
console.log("Local adapters loaded.");

const adapters = {...remoteAdapters, ...localAdapters };

const { env } = adapters;

const PORT = Number(env["API_PORT"] || env["PORT"] || 8001);

Deno.serve({ port: PORT }, async (req) => {
  let responseHeaders;
  // Get Body
  const body = await req.json().then((res: any) => res).catch((
    err: Error,
  ) => ({}));
  // Get Query parameters
  const url = new URL(req.url);
  const queryParams = Object.fromEntries(url.searchParams.entries());

  // Get Path name
  const pathname = new URL(req.url).pathname;

  // Get Path parameters
  const pathParams = url.pathname.split("/").filter((v) => v); // assuming url path is like /path/:param

  // Get Headers
  const headers = req.headers;
  const token = headers.get("Authorization")?.split(" ")?.[1] || env.TOKEN;

  const params: any = { ...body, ...queryParams };

  const res: any = await new Promise((resolve, reject) => {
    let response: any;
    let stream;
    let send;
    let responseType = "send";
    let sentResponse = false;

    response = new ReadableStream({
      start: (controller) => {
        stream = (data: any) => {
          try {
            responseType = "stream";
            controller.enqueue(new TextEncoder().encode(data));
            responseHeaders = {
              "content-type": "text/plain",
              "x-content-type-options": "nosniff",
            };
            if (!sentResponse) resolve(response);
            sentResponse = true;
          } catch (err) {
            console.log('erro 1', err);
            if (!sentResponse) resolve(err.message);
          }
        };
        send = (data: any) => {
          try {
            responseHeaders = { "content-type": "application/json" };
            if (!sentResponse) resolve(data);
            controller.close();
          } catch (err) {
            console.log('erro 2', err);
            if (!sentResponse) resolve(err.message);
          }
        };
      },
    });
    functionExec({ ...adapters, stream, respond: send })({
      pathname,
      params,
      token,
      v,
    })
      .then(send)
      .catch((err) => {
        console.log('erro 3', err);
        return !sentResponse ? resolve(err.message) : null
      });
  });

  return new Response(JSON.stringify(res), { headers: responseHeaders });
});
