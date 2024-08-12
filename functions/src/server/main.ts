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
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers":
              "authorization, x-client-info, apikey, content-type",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
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