import { match } from "npm:path-to-regexp";

const workers: any = {};
const responseHandlers: any = {};
const resolver: any = {};
const urlMetadatas: any = {};

export default (config: any) => async (params: any, response: any) => {
  const { currentUrl, importUrl, pathParams, queryParams, data, __requestId__ } = params;

  let urlMetadata;
  let isJSX = false;

  for (const key in urlMetadatas) {
    const regexp = match(key, { decode: decodeURIComponent });
    const matched = regexp(importUrl.pathname);
    if (matched) {
      urlMetadata = { ...urlMetadatas[key], params: matched.params };
    }
  }

  if (!urlMetadata) {
    urlMetadata = await fetch(importUrl.href, {
      redirect: "follow",
      headers: {
        "Content-Type": "application/json",
      },
    }).then((res) => res.json());
    let match = urlMetadata?.matchPath?.split(".")?.[0];
    if (!match?.startsWith("/")) match = "/" + match;
    urlMetadata.matchPath = match;
    urlMetadatas[match] = urlMetadata;
  }

  isJSX = urlMetadata?.path?.endsWith(".jsx") ||
    urlMetadata?.path?.endsWith(".tsx");

  const workerId = urlMetadata.matchPath;

  if (!workers[workerId]) {
    console.log("Instantiating worker", workerId);
    workers[workerId] = new Worker(
      new URL(`./${isJSX ? 'jsx-': ''}worker.js`, import.meta.url),
      {
        type: "module",
        deno: {
          permissions: {
            net: true,
            env: true,
            read: true,
            write: true,
            run:true,
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
    importUrl: new URL(urlMetadata.matchPath, importUrl.origin).href,
    currentUrl:currentUrl.href,
    params: { ...pathParams, ...urlMetadata.params, ...queryParams, ...data },
    isJSX,
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
        if (event.data.options) {
          responseHandlers[workerId][event.data.__requestId__].options(
            event.data.options,
          );
        }
        !event.data.__done__ && event.data.chunk && 
          responseHandlers[workerId][event.data.__requestId__].stream(
            event.data.chunk,
          );
        if (event.data.__done__) {
          resolver[event.data.__requestId__].resolve(event.data.chunk);
          delete responseHandlers[workerId][event.data.__requestId__];
          delete resolver[event.data.__requestId__];
          return;
        }
      }
    };

    workers[workerId].onerror = (event: any) => {
      console.error("Worker error:", event.message);
      // Reject all pending promises
      Object.values(responseHandlers[workerId]).forEach(({ reject, ...rest }: any) =>
        console.log(rest, reject) // reject && reject(event.message)
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
