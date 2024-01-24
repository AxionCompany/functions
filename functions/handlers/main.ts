import { match } from "npm:path-to-regexp";
import responseCallback from "../utils/responseCallback.ts";

export default (
  { handlers, middlewares, pipes, serializers, dependencies }: any,
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
          "Access-Control-Allow-Origin": "*",
          "content-type": "text/plain; charset=utf-8",
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
        cancel: () => {
          console.log('Stream cancelled', __requestId__);
          if (!responseSent) {
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

        if (serializedResponse) {
          controller.enqueue(new TextEncoder().encode(serializedResponse));
        }

        // Close the stream if done
        if (streamData.__done__ && !responseSent) {
          responseSent = true;
          controller.close();
        }

        resolveResponseHeaders();
      }

      handler(
        { url, pathname, pathParams, queryParams, data, headers, ctx, __requestId__ },
        responseCallback(__requestId__, streamCallback),
      )
        .then((data: any) => streamCallback({ chunk: data, __done__: true }))
        .catch(responseCallback(__requestId__, streamCallback).error);

      await responseHeadersPromise;

      return new Response(responseStream, options);
    } catch (err) {
      return new Response(
        JSON.stringify(err),
        {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers":
              "authorization, x-client-info, apikey, content-type",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
          },
          status: 500,
          statusText: "Internal Server Error",
        },
      );
    }
  };
