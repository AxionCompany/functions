
const getAvailablePort = async (startPort: number, endPort: number): Promise<number> => {
    for (let port = startPort; port <= endPort; port++) {
        try {
            const listener = Deno.listen({ port });
            listener.close();
            return port;
        } catch (error) {
            if (error instanceof Deno.errors.AddrInUse) {
                continue;
            }
            throw error;
        }
    }
    throw new Error("No available ports found.");
};


const port = await getAvailablePort(3000, 4000);
console.log(port)
const command = new Deno.Command(Deno.execPath(), {
    args: ['run', '-A', './subprocess-test.ts',`${port}`],
});
const process = command.spawn();
console.log(process)
