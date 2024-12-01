import { getTransport } from '../isolate-transport/index.ts';

export default async function isolateFactory({
    isolateType,
    isolateId,
    projectId,
    modules,
    port,
    isJSX,
    functionsDir,
    denoConfig,
    reload,
    bustCache,
    permissions,
    env
}: any) {
    const transport = getTransport();
    let address;

    if (isolateType === 'worker') {
        const worker = new Worker(
            new URL(`../../isolate/adapters/${isJSX ? 'jsx-' : ''}isolate.ts`, import.meta.url).href,
            { type: "module" }
        );
        worker.postMessage({ port, projectId, ...config });
        
        address = transport.createAddress({
            workerId: isolateId,
            worker
        });

    } else if (isolateType === 'nats') {
        // Start NATS isolate process
        const process = Deno.run({
            cmd: [
                "deno",
                "run",
                "-A",
                "--unstable",
                new URL(`../../isolate/adapters/${isJSX ? 'jsx-' : ''}isolate.ts`, import.meta.url).pathname,
                port.toString(),
                JSON.stringify({ projectId, ...config })
            ],
        });

        address = transport.createAddress({
            isolateId,
            process
        });

    } else {
        // Default to HTTP subprocess
        const process = Deno.run({
            cmd: [
                "deno",
                "run",
                "-A",
                "--unstable",
                new URL(`../../isolate/adapters/${isJSX ? 'jsx-' : ''}isolate.ts`, import.meta.url).pathname,
                port.toString(),
                JSON.stringify({ projectId, ...config })
            ],
        });

        address = transport.createAddress({
            port
        });
    }

    await transport.waitForReady(address);
    return address;
}
