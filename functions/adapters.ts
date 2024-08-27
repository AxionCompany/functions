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
    const isolateMaxIdleTime = 5000;
    return { ...adapters, isolateType: 'worker', mapFilePathToIsolateId, isolateMaxIdleTime, permissions: {"allow-sys": true } }
}


