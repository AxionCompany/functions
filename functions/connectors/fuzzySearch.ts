function normalize(token:string) {
    // Remove diacritics (accents) and convert to lower case
    return token
        .normalize("NFD") // Normalize the string using Unicode Normalization Form D (NFD)
        .replace(/[\u0300-\u036f]/g, "") // Remove diacritic marks
        .replace(/\W/g, '') // Remove non-alphanumeric characters
        .toLowerCase();
}

// The other functions remain the same

function tokenize(text:string) {
    return text.toLowerCase().split(/\s+/).filter(Boolean);
}

function jaccardIndex(setA:any, setB:any) {
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return intersection.size / union.size;
}

function fuzzySearch(searchString:string, targetString:string) {
    const searchTokens = new Set(tokenize(searchString).map(normalize));
    const targetTokens = new Set(tokenize(targetString).map(normalize));
    return jaccardIndex(searchTokens, targetTokens);
}

export default fuzzySearch;