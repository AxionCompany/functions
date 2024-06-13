
import { get, remove, set } from "https://deno.land/x/kv_toolbox/blob.ts";

const kv = await Deno.openKv();

export default (
  {
    baseUrl,
    baseHeaders,
    requestInterceptor,
    responseInterceptor,
    cacheTTL = 300,
    canCache = () => false,
  },
) =>
  async (path, { method = "GET", data, query, headers } = {}) => {
    // Unique ID for the request
    const uniqueId = Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);

    const makeQuery = (query) => {
      if (!query) {
        return "";
      }
      const queryString = Object.entries(query).map(([key, value]) => {
        return `${key}=${value}`;
      }).join("&");
      return `?${queryString}`;
    };

    const cache = canCache(path, { method: "GET", data, headers });

    let cacheKey;
    if (cache) {
      cacheKey = [
        "apiResponse",
        baseUrl + path + makeQuery(query),
      ].filter((i) => i);

      // Try to retrieve the response from cache
      let cachedResponse;
      try {
        const cachedData = await get(kv, cacheKey);
        cachedResponse = new TextDecoder().decode(cachedData);
      } catch (_) { }

      if (cachedResponse) {
        // console.log(JSON.stringify({
        //   "requestId": uniqueId,
        //   "type": "response",
        //   "cache": true,
        //   "url": baseUrl + path,
        //   "body": data,
        //   "response": cachedResponse,
        // }));

        return JSON.parse(cachedResponse);
      }
    }

    try {
      // Prepare the request
      let request = new Request(baseUrl + path + makeQuery(query), {
        method: method,
        body: data
          ? new TextEncoder().encode(JSON.stringify({ data: data }))
          : undefined,
        headers: {
          "Content-Type": "application/json",
          ...baseHeaders,
          ...headers,
        },
      });

      if (requestInterceptor) {
        request = await requestInterceptor(request);
      }

      const start = new Date().getTime();

      console.log(JSON.stringify({
        "requestId": uniqueId,
        "type": "request",
        "url": baseUrl + path + makeQuery(query),
        "body": data,
      }));

      baseUrl = baseUrl ? baseUrl : "";


      // Perform the network request
      const response = await fetch(baseUrl + path + makeQuery(query), {
        method: method,
        body: data ? JSON.stringify(data) : undefined,
        headers: {
          "Content-Type": "application/json",
          ...baseHeaders,
          ...headers,
        },
      });

      // Extract the response
      let res = await response.text();

      if (!response.ok) {
        throw JSON.stringify(res) || new Error(response.statusText);
      }

      if (cache) {
        // Store the response in cache
        set(kv, cacheKey, new TextEncoder().encode(res), { expireIn: cacheTTL });
      }

      const end = new Date().getTime();

      console.log(JSON.stringify({
        "requestId": uniqueId,
        "type": "response",
        "cache": false,
        "time": end - start,
        "url": baseUrl + path + makeQuery(query),
        // "body": data,
        // "response": res,
      }));

      try {
        res = JSON.parse(res);
      } catch (err) {
        err;
      }

      if (responseInterceptor) {
        res = await responseInterceptor(res);
      }

      return res;
    } catch (err) {
      console.log(err);
      let errorMessage;
      if (typeof err === "string") {
        errorMessage = err;
      } else {
        errorMessage = `Error: ${err.message}`;
      }
      return { error: true, message: errorMessage };
    }
  };


// export default () => (...args) => { }