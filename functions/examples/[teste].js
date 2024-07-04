const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
export default async (params, res)=>{
    res.stream("Olá, mundo!"+"\r\n")
    await sleep(1000)
    res.stream(new Date().toISOString() +"\r\n")
    await sleep(1000)
    res.stream(new Date().toISOString() +"\r\n")
    await sleep(1000)
    res.stream(new Date().toISOString() +"\r\n")
    await sleep(1000)
    res.stream(new Date().toISOString() +"\r\n")
    return;

}