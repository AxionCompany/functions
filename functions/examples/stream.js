
export default async (params, res) => {

    setInterval(() => {
        res.stream("It's :" + new Date().toISOString() + "\r\n")
    }, 1000)

    return await new Promise(() => { });
    
}