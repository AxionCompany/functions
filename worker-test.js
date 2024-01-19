Deno.serve({port: 8080}, (req) => {
    return new Response("Hello World\n")
});
