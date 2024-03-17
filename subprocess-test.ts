const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
console.log('CHEGOU AQUI');

async function measureSubprocessMemoryUsage() {
    // Measure initial memory usage
    const initialMemoryUsage = Deno.memoryUsage();
    const command = new Deno.Command("deno", {
        args: [
            "fmt",
            "-",
        ],
        stdin: "piped",
        stdout: "piped",
    });
    const process = command.spawn();
    const writer: any = process.stdin.getWriter();
    // Write the message data to the subprocess
    
    // writer.write(new TextEncoder().encode("console.log('hello')"));
    writer.releaseLock();
    await process.stdin.close();
    const result = await process.output();
    console.log(new TextDecoder().decode(result.stdout));
}

// Run the experiment
measureSubprocessMemoryUsage().then((result) => {
    console.log("Experiment results:", result);
});