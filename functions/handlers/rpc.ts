export default async (adapters: any) => {
  const { connectors } = adapters;
  const { moduleLoader } = connectors;

  let v: any = {};

  console.log("Loading local adapters...");
  const LocalAdapters = await moduleLoader.default({
    pathname: "adapters",
  })
    .then((res: any) => res.default)
    .catch((err: Error) => console.log("Error loading local adapters", err));

  adapters = LocalAdapters ? LocalAdapters(adapters) : adapters;
  console.log("Local adapters loaded.");

  const { features, middlewares } = adapters;

  const { functionExec } = features;

  return async (req: Request) => {
    let responseHeaders = {};
    // Get Body
    const body = await req.json().then((res: any) => res).catch((
      err: Error,
    ) => ({}));
    // Get Query parameters
    const url = new URL(req.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    // Get Path name
    const pathname = new URL(req.url).pathname;


    // Handle OPTIONS request
    if (req.method === "OPTIONS") return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
      },
    });

    // Get Path parameters
    const pathParams = url.pathname.split("/").filter((v) => v); // assuming url path is like /path/:param

    const params: any = { ...body, ...queryParams };
    let ctx: any = {};
    // Adding Middlewares
    try {
      for (const key in middlewares) {
        const middleware = middlewares[key];
        const addedContext = await middleware(req);
        ctx = { ...ctx, ...addedContext };
      }
    } catch (err) {
      return err;
    }

    try {

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
                console.log("error 1", err.message);
                if (!sentResponse) reject(err);
              }
            };
            send = (data: any) => {
              try {
                responseHeaders = { "content-type": "application/json" };
                if (!sentResponse) resolve(data);
                controller.close();
              } catch (err) {
                console.log("error 2", err.message);
                if (!sentResponse) reject(err);
              }
            };
          },
        });

        functionExec({ ...adapters, stream, respond: send })({
          pathname,
          params: { ...params, ...ctx },
          v,
        })
          .then(send)
          .catch((err: any) => {
            console.log("error 3", err.message);
            return !sentResponse ? reject(err) : null;
          });
      });

      return new Response(JSON.stringify(res), {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
          ...responseHeaders,
        },
      });
    } catch (err) {
      return new Response(JSON.stringify(err), {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
          ...responseHeaders,
        },
        status: err.status || 400,
        statusText: err.message || 'Bad Request',
      });
    }
  };
};
