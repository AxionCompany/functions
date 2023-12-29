import { match } from "npm:path-to-regexp";

export default (
  { handlers, middlewares, pipes, serializers, dependencies }: any,
) =>
async (req: Request) => {
  try {
    // Get Headers
    const headers = Object.fromEntries(req.headers.entries());

    // Get Body
    const body = await req
      .text()
      .then((_body: any) => {
        try {
          return JSON.parse(_body);
        } catch (_) {
          return _body;
        }
      })
      .catch((_: Error) => (null));

    // Get Query parameters
    const url = new URL(req.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    // Get Path name
    const pathname = new URL(req.url).pathname;

    // Match Handler
    let handler: any;
    let pathParams: any;
    let pathMatch: string;
    for (const key in handlers) {
      const regexp = match(key);
      const pathData: any = regexp(pathname);
      if (pathData?.params) {
        handler = handlers[key];
        pathParams = pathData.params;
        pathMatch = key;
        break;
      }
    }

    // Handle OPTIONS request
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers":
            "authorization, x-client-info, apikey, content-type",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
        },
      });
    }

    let data: any = typeof body === "string" ? { data: body } : { ...body };
    let ctx: any = {};

    // Adding Middlewares
    for (const key in middlewares) {
      const middleware = middlewares[key];
      const addedContext = await middleware(req);
      ctx = { ...ctx, ...addedContext };
    }

    // Adding Pipes
    for (const key in pipes) {
      const pipe = pipes[key];
      const pipeData = await pipe(data, ctx);
      data = { ...data, ...pipeData };
    }

    let options = {
      status: 200,
      statusText: "OK",
      headers: {
        "content-type": "text/plain",
        "x-content-type-options": "nosniff",
      },
    };

    // Execute Handler
    const responseStream: any = await new Promise((resolve) => {
      let stream: any;

      const responseData = new ReadableStream({
        start: async (controller) => {
          stream = async (response: any) => {
            if (response === "__END__") return controller.close();
            try {
              let serializedResponse = response;
              for (const key in serializers) {
                const serializer = serializers[key];
                serializedResponse = await serializer(
                  data,
                  ctx,
                  serializedResponse,
                );
              }
              if (typeof serializedResponse === "object") {
                serializedResponse = JSON.stringify(serializedResponse);
              }
              if (
                response?.startsWith && response?.startsWith("__OPTIONS__")
              ) {
                const newOptions = JSON.parse(
                  response.replace("__OPTIONS__", ""),
                );
                return options = {
                  ...options,
                  ...newOptions,
                  headers: {
                    ...options.headers,
                    ...newOptions.headers,
                  },
                };
              }

              controller.enqueue(
                new TextEncoder().encode(serializedResponse),
              );

              resolve(responseData);
            } catch (err) {
              controller.enqueue(
                new TextEncoder().encode(
                  JSON.stringify({
                    message: err.message || "Internal Server Error",
                    error: err,
                    status: err.status || 500,
                  }),
                ),
              );
            }
          };
        },
      });

      handler({ url, pathname, pathParams, pathMatch, queryParams, data, headers, ctx }, {
        stream,
        send: (e: any) => {
          stream(e).then((_: any) => stream("__END__"));
        },
        redirect: (url: string) => {
          stream(
            "__OPTIONS__" + JSON.stringify({
              status: 307,
              statusText: "Temporary Redirect",
              headers: {
                "location": url,
              },
            }),
          );
        },
        status: (status: number) => {
          stream(
            "__OPTIONS__" + JSON.stringify({
              status,
            }),
          );
        },
        statusText: (statusText: string) => {
          stream(
            "__OPTIONS__" + JSON.stringify({
              statusText,
            }),
          );
        },
        options: (config: any) => {
          stream("__OPTIONS__" + JSON.stringify(config));
        },
      })
        .then(stream)
        .then((_: null) => stream("__END__"))
        .catch((err: any) => {
          stream({
            message: err.message || "Internal Server Error",
            error: err,
            status: err.status || 500,
          });
          stream("__END__")
        });
    });

    return new Response(responseStream, options);
  } catch (err) {
    return new Response(
      JSON.stringify({
        message: err.message || "Internal Server Error",
        error: err,
        status: err.status || 500,
      }),
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers":
            "authorization, x-client-info, apikey, content-type",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
        },
      },
    );
  }
};
