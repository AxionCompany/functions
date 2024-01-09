import { match } from "npm:path-to-regexp";
import responseCallback from "../utils/responseCallback.ts";

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
          "Access-Control-Allow-Origin": "*",
          "content-type": "text/plain",
          "x-content-type-options": "nosniff",
        },
      };

      let controller: any;
      let resolver: any;
      let responseSent = false;

      const responseStream: any = new Promise((resolve) => {
        const _responseStream = new ReadableStream({
          start: (ctlr) => {
            controller = ctlr;
          },
          cancel: () => {
            controller.close();
          },
        });
        resolver = () => {
          responseSent = true;
          return resolve(_responseStream)
        };
      });

      const streamCallback = async (streamData: any) => {
        try {
          if (controller.desiredSize <= 0) {
            if(responseSent) console.log("Response Already Sent", streamData);
            return;
          }
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

          serializedResponse && controller.enqueue(
            new TextEncoder().encode(serializedResponse),
          );

          if (streamData.__done__) {
            controller.close();
          }

          resolver();
        } catch (err) {
          console.log("streamCallback error", err);
          options = {
            ...options,
            status: err.status || 500,
            statusText: err.message || "Internal Server Error",
            headers: {
              ...options.headers,
              "content-type": "application/json",
            },
          };
          controller.enqueue(new TextEncoder().encode(JSON.stringify(err)));
          controller.close();
          resolver();
        }
      };

      const __requestId__ = crypto.randomUUID();

      handler(
        {
          url,
          pathname,
          pathParams,
          queryParams,
          data,
          headers,
          ctx,
          __requestId__,
        },
        responseCallback(__requestId__, streamCallback),
      )
        .then(async (data: any) =>
          await streamCallback({ chunk: data, __done__: true })
        )
        .catch((err: any) =>
          streamCallback({
            chunk: {
              message: err.message || "Internal Server Error",
              error: err,
              status: err.status || 500,
            },
            options: {
              status: err.status || 500,
              statusText: err.message || "Internal Server Error",
            },
            __done__: true,
          })
        );
      const resolvedResponseStream: ReadableStream = await responseStream
        .then((res: any) => res)
        .catch(console.log);

      return new Response(resolvedResponseStream, options);
    } catch (err) {
      let res;
      if (typeof err === "object") {
        res = err;
      } else {
        res = { message: err };
      }
      return new Response(
        JSON.stringify(res),
        {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers":
              "authorization, x-client-info, apikey, content-type",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
          },
          status: err.status || 400,
          statusText: err.message || "Bad Request",
        },
      );
    }
  };
