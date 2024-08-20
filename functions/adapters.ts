const maxIsolates = 2;
let currentIsolateIndex = 0;

// isolate load balancer with round-robin strategy;

export default (adapters: any) => {

    const mapFilePathToIsolateId = null
    // ({ formattedFileUrl: _filePathUrl }: { formattedFileUrl: string }) => {
    //     // remove search params from the URL
    //     currentIsolateIndex++
    //     const isolateId = String(currentIsolateIndex % maxIsolates)
    //     return isolateId
    // };
    const isolateMaxIdleTime = null;
    return { ...adapters, mapFilePathToIsolateId, isolateMaxIdleTime, permissions: { "allow-sys": true } }
}


