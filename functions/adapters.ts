export default (adapters: any) => {
    const setIsolateSearchUrl = (url: URL) => url.origin + '/.tsx'; // add .tsx to the end of the url to use .TSX isolate renderer
    const setIsolateUrlPattern = (url: URL) => url.origin + '/.tsx'; // add .tsx to the end of the url to use .TSX isolate renderer
    return { ...adapters, setIsolateSearchUrl, setIsolateUrlPattern, permissions: { "allow-sys": true } }
}

