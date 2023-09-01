export default async ({ env, ...adapters }: any) => {

  const { connectors, features } = adapters;
  const { moduleLoader } = connectors;
  const { functionExec } = features;

  let v: any = {};

  console.log("Loading local adapters...");
  const LocalAdapters = await moduleLoader.default({
    pathname: "adapters.ts",
  })
    .then((res: any) => res.default)
    .catch((err: Error) => console.log("Error loading local adapters", err));

  adapters = LocalAdapters ? LocalAdapters(adapters) : adapters;
  console.log("Local adapters loaded.");

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
              console.log('error 1', err.message);
              if (!sentResponse) resolve(err.message);
            }
          };
          send = (data: any) => {
            try {
              responseHeaders = { "content-type": "application/json" };
              if (!sentResponse) resolve(data);
              controller.close();
            } catch (err) {
              console.log('error 2', err.message);
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
        .catch((err: any) => {
          console.log('error 3', err.message);
          return !sentResponse ? resolve(err.message) : null;
        });
    });

    return new Response(JSON.stringify(res), {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
        ...responseHeaders,
      },
    });
  };
};
