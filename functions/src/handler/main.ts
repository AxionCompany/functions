import responseCallback from "./utils/responseCallback.ts";
import { getSubdomain } from "./utils/urlFunctions.ts";

interface DataChunk {
  options?: { [key: string]: string };
  chunk: string;
  __requestId__?: string;
  __done__?: boolean;
  __error__?: boolean;
}

export default (
  { handlers }: any,
) => {

  function createStreamBuffer(highWaterMark: number = 1, { processData, sendOptions }: any) {

    let buffer: Uint8Array[] = [];
    let controller: ReadableStreamDefaultController<Uint8Array>;
    let headersSent = false;
    let shouldClose = false;

    const readableStream = new ReadableStream<Uint8Array>({
      start(ctrl) {
        controller = ctrl;
      },
      pull() {
        flushBuffer();
      },
      cancel() {
        buffer = [];
        headersSent = false;
        shouldClose = false;
      }
    }, {
      highWaterMark
    });

    function enqueue(data: DataChunk) {


      data = processData(data);

      const encodedChunk = new TextEncoder().encode(data.chunk);
      if (controller.desiredSize! > 0) {
        controller.enqueue(encodedChunk);
      } else {
        buffer.push(encodedChunk);
      }

      if (data.__done__ || data.__error__) {
        shouldClose = true;
        flushBuffer();

      }

      if (!headersSent && data.options) {

        headersSent = true;
        sendOptions(data.options);
      }

    }

    function flushBuffer() {
      while (buffer.length > 0 && controller.desiredSize! > 0) {
        const chunk: any = buffer.shift();
        controller.enqueue(chunk);
      }
      if (shouldClose && buffer.length === 0) {
        controller.close();
      }
    }

    function getStream(): ReadableStream<Uint8Array> {
      return readableStream;
    }

    return { enqueue, getStream };
  }

  return async (req: Request) => {

    const handleRequest = async (req: Request) => {
      try {
        // Get Headers
        const headers = Object.fromEntries(req.headers.entries());
        const contentType = headers?.["content-type"] || headers?.["Content-Type"] || "";
        const __requestId__ = crypto.randomUUID();

        const formData: Record<string, any> = {};

        if (contentType.includes("multipart/form-data")) {

          const form = await req.formData();
          for (const [key, value] of form.entries()) {
            if (value instanceof File) {
              // transform file to base64
              const reader = new FileReader();
              const base64dataPromise = new Promise<string | ArrayBuffer | null>((resolve) => {
                reader.onloadend = () => {
                  const base64data = reader.result;
                  resolve(base64data);
                };
              });
              reader.readAsDataURL(value);
              const base64data = await base64dataPromise;
              if (!formData[key]) {
                formData[key] = base64data;
              } else if (Array.isArray(formData[key])) {
                formData[key].push(base64data);
              } else {
                formData[key] = [formData[key], base64data];
              }
            }
          }
        }


        // Get Body
        const body = await req
          ?.text()
          ?.then((_body: any) => {
            try {
              return JSON.parse(_body);
            } catch (_) {
              return _body;
            }
          })
          ?.catch((_: Error) => (null));

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

        let data: any;
        if (body) {
          data = typeof body === "string" ? { data: body } : { ...body };
        }

        let sendOptions: any

        let responseHeadersPromise: any = new Promise((resolve) => {
          return sendOptions = (options: any) => resolve({
            status: options?.status || 200,
            statusText: options?.statusText || "OK",
            ...options,
            headers: {
              "access-control-allow-origin": "*",
              "content-type": "text/plain",
              "x-content-type-options": "nosniff",
              ...options?.headers,
            },
          })
        });

        const processData = ({ chunk, options, __requestId__, __done__ }: any) => {

          options = options || {};

          if (chunk && typeof chunk === "object") {
            chunk = JSON.stringify(chunk);

            options.headers = {
              ...options?.headers,
              "content-type": "application/json",
            };
          }

          return { chunk, options, __requestId__, __done__ };
        }

        const { getStream, enqueue } = createStreamBuffer(1, { processData, sendOptions });

        const responseFn = responseCallback(__requestId__, enqueue);

        handler(
          { url, subdomain, pathname, pathParams, method, queryParams, data, formData, headers, __requestId__ },
          responseFn,
        ).then(responseFn.send).catch(responseFn.error);

        const options = await responseHeadersPromise;
        responseHeadersPromise = null;

        return new Response(getStream(), options);
      } catch (err) {

        const options: any = {
          status: 500,
          statusText: "Internal Server Error",
          headers: {
            "Access-Control-Allow-Origin": "*",
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


    return await handleRequest(req);
  }
}



