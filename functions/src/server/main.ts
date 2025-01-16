export default (
  { port, requestHandler, config }: any,
) => {
  const server = Deno.serve(
    { port: port || config?.PORT || 8000 },
    async (req: Request) => {
      // Handle OPTIONS request
      if (req.method === "OPTIONS") {
        // to do: improve this
        return new Response("OK", {
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-headers":
              "authorization, x-client-info, apikey, content-type",
            "access-control-allow-methods": "GET, POST, PUT, DELETE",
          },
          "status": 200,
          "statusText": "OK",
        });
      }
      const response = await requestHandler(req);
      return response
    },
  );
  return server.finished;
};