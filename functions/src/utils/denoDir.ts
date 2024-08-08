
const getDenoDirectories = async () => {

    const info = new TextDecoder().decode(
        (await (new Deno.Command(Deno.execPath(), { args: ['info'] })).output())
            .stdout
    );

    const [denoDir, deps, npm, gen, registries, location_data] = info.split('\n').map(i => (i.trim().split(':')[1])).filter(Boolean).map(i => i.split(' ')[1])
    return { denoDir: denoDir, deps, npm, gen, registries, location_data }
}


export default getDenoDirectories;