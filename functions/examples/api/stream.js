// This function will be called when a client makes a request to /examples/api/stream

export default async (params, res) => {

    // Extract the name parameter from the request
    const greetings = params?.name ? `Hello ${params.name}!` : "Hello!";
    // Send the greetings to the client in the stream
    res.stream(greetings + "\r\n");
    // This function will keep sending the current time to the client every second
    setInterval(() => {
        // Send the current time to the client in the stream
        res.stream("It's :" + new Date().toISOString() + "\r\n")
    }, 1000);

    await new Promise(() => { }); // this will never resolve, so the stream will keep going indefinitely

    return // should always end a function with a return statement

}