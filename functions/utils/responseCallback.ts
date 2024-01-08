export default (__requestId__: string, cb: Function) => {
  return {
    send: (chunk: string) => cb({ __requestId__, chunk, __done__: true }),
    redirect: (url: string) =>
      cb({
        __requestId__,
        options: {
          status: 307,
          statusText: "Temporary Redirect",
          headers: {
            location: url,
          },
        },
        __done__: true,
      }),
    stream: (chunk: string) => cb({ __requestId__, chunk }),
    status: (code: string) => cb({ __requestId__, options: { status: code } }),
    statusText: (text: string) =>
      cb({ __requestId__, options: { statusText: text } }),
    options: (options: any) => cb({ __requestId__, options }),
    headers: (headers: any) => cb({ __requestId__, options: { headers } }),
  };
};
