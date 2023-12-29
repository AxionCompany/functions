const workers: any = {};

export default (config: any) => async (params: any) => {
    console.log('chegou aqui')
  const { url, pathParams, queryParams, data } = params;
  const { customLoader } = config;

  const urlMetadata = await fetch(url.href, {
    redirect: 'follow',
    headers: {
      "Content-Type": "application/json",
    },
  }).then((res) => res.json());

  console.log(urlMetadata)

  const matchPath = urlMetadata.matchPath;


  if (!workers[matchPath]) {
    workers[matchPath] = new Worker(
      new URL("./worker.js", import.meta.url),
      {
        type: "module",
        deno: {
          permissions: {
            net: true,
            env: false,
            read: false,
            write: false,
          },
        },
      },
    );
  }

  const __requestId__ = crypto.randomUUID();

  workers[matchPath].postMessage({
    __requestId__: __requestId__,
    url: url.href,
    params: { ...pathParams, ...queryParams, ...data },
  });

  const result = await new Promise((resolve, reject) => {
    workers[matchPath].onmessage = (event: any) => {
      if (event?.data?.__requestId__ !== __requestId__) return;
      if (event?.data?.__error__) return reject(event.data);
      const { __requestId__: _, ...rest } = event.data;
      return resolve(rest);
    };
    workers[matchPath].onerror = (event: any) => {
      if (event?.data?.__requestId__ !== __requestId__) return;
      return reject(event.data);
    };
    workers[matchPath].onmessageerror = (event: any) => {
      if (event?.data?.__requestId__ !== __requestId__) return;
      return reject(event.data);
    };
  });

  return result;
};
