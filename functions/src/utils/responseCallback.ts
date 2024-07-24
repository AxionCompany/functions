const responseCallback = (__requestId__: string, cb: Function) => {
  return {
    send: (chunk: string) => cb({ __requestId__, chunk, __done__: true }),
    redirect: (url: string, headers = {}) =>
      cb({
        __requestId__,
        options: {
          status: 307,
          statusText: "Temporary Redirect",
          headers: {
            location: url,
            ...headers,
          },
        },
        chunk: ""
      }),
    stream: (chunk: string) => cb({ __requestId__, chunk }),
    status: (code: string) => cb({ __requestId__, options: { status: code } }),
    statusText: (text: string) =>
      cb({ __requestId__, options: { statusText: text } }),
    options: (options: any) => cb({ __requestId__, options }),
    headers: (headers: any) => cb({ __requestId__, options: { headers } }),
    error: (chunk: any) => {
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

      if (typeof chunk === "object") {
        options.status = chunk.status || options.status;
        options.statusText = chunk.message || options.statusText;
      }

      let error: any = {}
      if (typeof chunk === "string") {
        error.message = chunk
      } else {
        error = {
          message: chunk.message,
          stack: chunk.stack,
        }
      }
      console.log('ERROR', error, __requestId__, options,)

      return cb({ chunk: { error }, __requestId__, __error__: true, options, __done__: true });
    }
  };
};

export default responseCallback;
