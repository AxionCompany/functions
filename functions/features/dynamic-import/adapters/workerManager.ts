import { match } from "npm:path-to-regexp";

const workers: any = {};
const responseHandlers: any = {};
const resolver: any = {};
const urlMetadatas: any = {};

export default (config: any) => async (params: any, response: any) => {
  const { url, pathParams, queryParams, data, __requestId__ } = params;

  let urlMetadata;

  for (const key in urlMetadatas) {
    const regexp = match(key, { decode: decodeURIComponent });
    const matched = regexp(url.pathname);
    if (matched) {
      urlMetadata = { ...urlMetadatas[key], params: matched.params };
    }
  }

  if (!urlMetadata) {
    urlMetadata = await fetch(url.href, {
      redirect: "follow",
      headers: {
        "Content-Type": "application/json",
      },
    }).then((res) => res.json());
    let match = urlMetadata.matchPath.split(".")[0];
    if (!match.startsWith("/")) match = "/" + match;
    urlMetadata.matchPath = match;
    urlMetadatas[match] = urlMetadata;
  }

  const workerId = urlMetadata.matchPath;

  if (!workers[workerId]) {
    console.log("Instantiating worker", workerId);
    workers[workerId] = new Worker(
      new URL("./worker.js", import.meta.url),
      {
        type: "module",
        deno: {
          permissions: {
            net: true,
            env: true,
            read: true,
            write: true,
            ...config.permissions,
          },
        },
      },
    );
  }

  const promiseResult = new Promise((resolve, reject) => {
    responseHandlers[workerId] = { ...responseHandlers?.[workerId] };
    responseHandlers[workerId][__requestId__] = response;
    return (resolver[__requestId__] = { resolve, reject });
  });

  workers[workerId].postMessage({
    __requestId__: __requestId__,
    url: new URL(urlMetadata.matchPath, url.origin).href,
    params: { ...pathParams, ...urlMetadata.params, ...queryParams, ...data },
  });

  // Global onmessage handler
  if (!workers[workerId].onmessage) {
    workers[workerId].onmessage = (event: any) => {
      const handler = responseHandlers[workerId][event.data.__requestId__];
      if (handler) {
        if (event.data.__error__) {
          console.log(
            "Error from worker for request",
            event.data.__requestId__,
          );
          resolver[event.data.__requestId__].reject(event.data);
          delete responseHandlers[workerId][event.data.__requestId__];
          delete resolver[event.data.__requestId__];
          return;
        }
        if (event.data.__done__) {
          resolver[event.data.__requestId__].resolve(event.data.chunk);
          delete responseHandlers[workerId][event.data.__requestId__];
          delete resolver[event.data.__requestId__];
          return;
        }
        responseHandlers[workerId][event.data.__requestId__].stream(
          event.data.chunk,
        );
      }
    };

    workers[workerId].onerror = (event: any) => {
      console.error("Worker error:", event.message);
      // Reject all pending promises
      Object.values(responseHandlers[workerId]).forEach(({ reject }: any) =>
        reject(event.message)
      );
      responseHandlers[workerId] = {}; // Clear the handlers
      delete workers[workerId];
    };

    workers[workerId].onmessageerror = (event: any) => {
      console.error("Message error:", event.data);
      // Handle message errors similarly
      Object.values(responseHandlers[workerId]).forEach(({ reject }: any) =>
        reject(event.data)
      );
      responseHandlers[workerId] = {}; // Clear the handlers
      delete workers[workerId];
    };
  }

  return promiseResult;
};
