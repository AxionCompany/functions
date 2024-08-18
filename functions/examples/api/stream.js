// This function will be called when a client makes a request to /examples/api/stream
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const stream = async (params, res) => {

    const { url } = stream;

    // Extract the name parameter from the request
    const greetings = params?.name ? `Hello ${params.name}!` : "Hello!";
    // Send the greetings to the client in the stream
    res.stream(greetings + "\r\n" + 'from ' + JSON.stringify(url) + JSON.stringify(import.meta.url));
    // This function will keep sending the current time to the client every second
    const interval = setInterval(() => {
        // Send the current time to the client in the stream
        res.stream("It's :" + new Date().toISOString() + "\r\n")
    }, 1000);

    await sleep(15000); // wait for 15 seconds

    return // should always end a function with a return statement

}

export default stream;