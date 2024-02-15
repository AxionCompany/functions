import { match } from "npm:path-to-regexp";

const workers: any = {};
const responseHandlers: any = {};
const resolver: any = {};
const urlMetadatas: any = {};

export default (config: any) => async (params: any, response: any) => {
  const { currentUrl, importUrl, pathParams, queryParams, data, __requestId__ } = params;

  const importSearchParams = new URL(importUrl).searchParams.toString();

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
      new URL(`./${isJSX ? 'jsx-' : ''}worker.js`, import.meta.url),
      {
        type: "module",
        // deno: {
          // permissions: {
          //   net: true,
          //   env: true,
          //   read: true,
          //   write: true,
          //   run: true,
          //   sys: true,
          //   ...config.permissions,
          // },
        // },
      },
    );
  }

  const promiseResult = new Promise((resolve, reject) => {
    responseHandlers[workerId] = { ...responseHandlers?.[workerId] };
    responseHandlers[workerId][__requestId__] = response;
    resolver[workerId] = { ...resolver?.[workerId] };
    resolver[workerId][__requestId__] = { resolve, reject };
    return resolver[workerId][__requestId__]
  });

  workers[workerId].postMessage({
    __requestId__: __requestId__,
    importUrl: new URL(`${urlMetadata.matchPath}?${importSearchParams}`, importUrl.origin).href,
    currentUrl: currentUrl.href,
    params: { ...pathParams, ...urlMetadata.params, ...queryParams, ...data },
    isJSX,
  });

  // Global onmessage handler
  if (!workers[workerId].onmessage) {
    workers[workerId].onmessage = (event: any) => {
      const handler = responseHandlers[workerId][event.data.__requestId__];
      if (handler) {
        if (event?.data?.options) {
          responseHandlers[workerId][event.data.__requestId__].options(
            event.data.options,
          );
        }
        !event?.data?.__done__ && event?.data?.chunk &&
          responseHandlers[workerId][event.data.__requestId__].stream(
            event.data.chunk,
          );
        if (event?.data?.__done__) {
          resolver[workerId][event.data.__requestId__].resolve(event.data.chunk);
          delete responseHandlers[workerId][event.data.__requestId__];
          delete resolver[workerId][event.data.__requestId__];
          return;
        }
        return 
      }
    };

    workers[workerId].onerror = (event: any) => {
      Object.values(resolver[workerId]).forEach(({ reject }: any) => {
        console.log(reject)
        return reject(event?.message)
      });
      responseHandlers[workerId] = {};
      resolver[workerId] = {};
      delete workers[workerId];
    };

    workers[workerId].onmessageerror = (event: any) => {
      console.error("Message error:", event?.data);

      Object.values(resolver[workerId]).forEach(({ reject }: any) => {
        return reject(event?.message)
      });
      responseHandlers[workerId] = {};
      resolver[workerId] = {};
      delete workers[workerId];
    };
  }

  return promiseResult;
};
