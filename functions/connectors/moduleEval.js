// evaluates a string as a ESM module
export default function moduleEval(str) {
    const url = "data:text/javascript;base64," + btoa(str)
    return import(url)
}
