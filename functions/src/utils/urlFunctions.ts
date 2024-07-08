export function extractHostname(url: string) {
    var hostname;
    //find & remove protocol (http, ftp, etc.) and get hostname

    if (url.indexOf("//") > -1) {
        hostname = url.split('/')[2];
    } else {
        hostname = url.split('/')[0];
    }

    //find & remove port number
    hostname = hostname.split(':')[0];
    //find & remove "?"
    hostname = hostname.split('?')[0];

    validateDomain(hostname);
    return hostname;
}

// Warning: you can use this function to extract the "root" domain, but it will not be as accurate as using the psl package.

export function extractRootDomain(url: string) {

    let domain = extractHostname(url)

    if (/^[0-9.]+$/.test(domain)) {
        return domain; // Domain is IP addresses
    }

    if (domain.split('.').slice(-1)[0] === 'localhost') {
        return 'localhost'; // No subdomain for localhost
    }

    const splitArr = domain.split('.')
    const arrLen = splitArr.length;

    //extracting the root domain 
    //if there is a subdomain
    if (arrLen > 2) {
        domain = splitArr[arrLen - 2] + '.' + splitArr[arrLen - 1];
        //check to see if it's using a Country Code Top Level Domain (ccTLD) (i.e. ".me.uk", ".com.br")
        if (
            (
                splitArr[arrLen - 2].length == 2 || // example .co.uk
                splitArr[arrLen - 2].length == 3  // example .com.br
            )
            && splitArr[arrLen - 1].length == 2) {
            //this is using a ccTLD
            domain = splitArr[arrLen - 3] + '.' + domain;
        }
    }

    validateDomain(domain);
    return domain;
}

export const urlHostname = (url: string) => {
    try {
        return new URL(url).hostname;
    }
    catch (e) { return e; }
};

export const validateDomain = (s: string) => {
    try {
        new URL("https://" + s);
        return true;
    }
    catch (e) {
        console.error(e);
        return false;
    }
};

export const getSubdomain = (url: string) => {
    // Use the URL constructor to parse the URL
    const parsedUrl = new URL(url);

    // Extract the hostname
    const hostname = parsedUrl.hostname;

    // Get the root domain
    const rootDomain = extractRootDomain(url);

    // Extract the subdomain
    const subdomain = hostname.replace(rootDomain, '').slice(0, -1);

    return subdomain;

}