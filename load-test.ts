const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Configuration
const endpoint = (i) => `http://localhost:9002/examples/bench`;
const concurrentRequests = 100;
const totalRequests = 100;
let requestCount = 0;

// Function to send a single request
async function sendRequest(i) {
    const start = Date.now();
    let response;
    try {
        response = await fetch(endpoint(i));
    } catch (error) {
        console.error(`Fetch error: ${error.message}`);
        throw 0;
    }
    const end = Date.now();
    if (!response.ok) {
        console.error(`Request failed with status ${response.status} `);
        console.log(await response.text());
        throw 0;
    }
    return end - start;
}

// Function to perform load testing
async function loadTest() {
    const start = Date.now();
    const times: number[] = [];
    let errors = 0;

    for (let i = 0; i < totalRequests; i++) {
        const promises: Promise<number>[] = [];
        for (let j = 0; j < concurrentRequests; j++) {
            requestCount++;
            promises.push(sendRequest(i).catch((error) => {
                console.error(`Error in request: ${error.message} `);
                errors++;
                return 0;
            }));
        }
        console.log('Sending batch', i + 1, 'of', concurrentRequests, 'requests')
        const now = Date.now();
        const results = await Promise.all(promises);
        console.log('Batch', i + 1, 'completed in', Date.now() - now, 'ms');
        times.push(...results);

        // Optional: Delay between batches
        // await sleep(100);
    }

    // Calculate and display statistics
    const totalTime = times.reduce((acc, time) => acc + time, 0);
    const avgTime = totalTime / times.length;
    const maxTime = Math.max(...times);
    const minTime = Math.min(...times);

    console.log(`Total requests: ${requestCount} `);
    console.log(`Total errors: ${errors} `);
    console.log(`Total time: ${Date.now() - start} ms`);
    console.log(`Average response time: ${avgTime.toFixed(2)} ms`);
    console.log(`Average requests per second: ${(times.length / ((Date.now() - start) / 1000)).toFixed(2)} `)
    console.log(`Max response time: ${maxTime} ms`);
    console.log(`Min response time: ${minTime} ms`);
}

// Run the load test
loadTest().catch((error) => {
    console.error("Load test failed:", error);
});