export default (
  { port, requestHandler, config }: any,
) => {
  const corsHeaders = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "GET, POST, PUT, DELETE",
  };

  const server = Deno.serve(
    { port: port || config?.PORT || 8000 },
    async (req: Request) => {
      // Handle OPTIONS request
      if (req.method === "OPTIONS") {
        return new Response("OK", {
          headers: corsHeaders,
          status: 200,
          statusText: "OK",
        });
      }

      const response = await requestHandler(req);
      
      // Add CORS headers to all responses
      const responseHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        responseHeaders.set(key, value);
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });
    },
  );
  return server.finished;
};