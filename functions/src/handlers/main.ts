import responseCallback from "../utils/responseCallback.ts";

export default (
  { handlers, middlewares, pipes, serializers }: any,
) =>
  async (req: Request) => {
    try {
      // Get Headers
      const headers = Object.fromEntries(req.headers.entries());
      const __requestId__ = crypto.randomUUID();

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
      const subdomain = getSubdomain(req.url);
      const queryParams = Object.fromEntries(url.searchParams.entries());
      const method = req.method;

      // Get Path name
      let pathname = new URL(req.url).pathname;

      // Match Handler
      let handler: any;
      let pathParams: any;
      let pathMatch: string;
      for (const key in handlers) {
        const routehandler = new URLPattern({ pathname: key });
        const _match = routehandler.exec(new URL(req.url))
        const pathData = { params: _match?.pathname?.groups };
        if (pathData?.params) {
          const pathParts = pathData.params["0"] ? pathData?.params["0"] : '';
          pathname = ("/" + pathParts).replace(/\/{2,}/g, "/");
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

      let data: any;
      if (body) {
        data = typeof body === "string" ? { data: body } : { ...body };
      }
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
          "access-control-allow-origin": "*",
          "content-type": "text/plain",
          "x-content-type-options": "nosniff",
        },
      };

      let controller: any;
      let responseSent = false;
      let resolveResponseHeaders: any;

      const responseHeadersPromise = new Promise((resolve) => {
        resolveResponseHeaders = resolve;
      });

      const responseStream = new ReadableStream({
        start: (ctlr) => {
          controller = ctlr;
        },
        // pull(ctlr) {
        //   if (ctlr.desiredSize && ctlr.desiredSize > 0) {
        //     controller = ctlr;
        //   }
        // },
        cancel: () => {
          console.log('Stream cancelled', __requestId__);
          if (!responseSent) {
            responseSent = true;
            controller.close();
          }
        }
      });

      const streamCallback = async (streamData: any) => {

        if (streamData.options) {
          options = {
            ...options,
            ...streamData.options,
            headers: {
              ...options.headers,
              ...streamData.options.headers,
            },
          };
        }

        let serializedResponse = streamData?.chunk;

        for (const key in serializers) {
          const serializer = serializers[key];
          serializedResponse = await serializer(
            data,
            ctx,
            serializedResponse,
          );
        }

        if (
          serializedResponse &&
          typeof serializedResponse === "object"
        ) {
          serializedResponse = JSON.stringify(serializedResponse);
          options.headers = {
            ...options.headers,
            "content-type": "application/json",
          };
        }

        if (serializedResponse
          && !responseSent
        ) {
          const encoded = new TextEncoder().encode(serializedResponse);
          controller.enqueue(encoded);
        }

        // Close the stream if done
        if (streamData.__done__
          && !responseSent
        ) {
          responseSent = true;
          controller.close();
        }
        resolveResponseHeaders();
      }

      const responseFn = responseCallback(__requestId__, streamCallback);
      handler(
        { url, subdomain, pathname, pathParams, method, queryParams, data, headers, ctx, __requestId__ },
        responseFn,
      )
        .then(responseFn.send)
        .catch(responseFn.error);

      await responseHeadersPromise;

      // delete options.headers["access-control-allow-origin"];
      return new Response(responseStream, options);
    } catch (err) {

      const options: any = {
        status: 500,
        statusText: "Internal Server Error",
        headers: {
          // "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers":
            "authorization, x-client-info, apikey, content-type",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
          "content-type": "application/json"
        }
      }

      if (typeof err === "object") {
        options.status = err.status || options.status;
        options.statusText = err.message || err.statusText || options.statusText;
      }

      let error: any = {}
      if (typeof err === "string") {
        error.message = err
      } else {
        error = {
          message: err.message || err.statusText,
          status: err.status || options.status,
          stack: err.stack,
        }
      }

      return new Response(
        JSON.stringify({ error }),
        options
      );
    }
  };


export function getSubdomain(url:string) {
  // Use the URL constructor to parse the URL
  const parsedUrl = new URL(url);

  // Extract the hostname
  const hostname = parsedUrl.hostname;

  // Split the hostname into parts
  const parts = hostname.split('.');

  // Handle special cases for localhost and IP addresses
  if (hostname === 'localhost' || /^[0-9.]+$/.test(hostname)) {
    return ''; // No subdomain for localhost or IP addresses
  }

  // If there are more than two parts, the subdomain is everything except the last two parts
  if (parts.length > 2) {
    return parts.slice(0, -2).join('.');
  }

  // If there are only two parts, there's no subdomain
  return '';
}
