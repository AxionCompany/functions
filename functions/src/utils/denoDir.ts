
const getDenoDirectories = async () => {

    const info = new TextDecoder().decode(
        (await (new Deno.Command(Deno.execPath(), { args: ['info'] })).output())
            .stdout
    );

    const [denoDir, deps, npm, gen, registries, location_data] = info.split('\n').map(i => (i.trim().split(':')[1])).filter(Boolean).map(i => i.split(' ')[1])
    return { denoDir: denoDir, deps, npm, gen, registries, location_data }
}

// getDenoDirectories().then(console.log)

// reload cache 

const reloadCache = async (url: string[] | string) => {
    let origin = '';
    if (Array.isArray(url)) {
        const origins: string[] = [];
        url.forEach(i => {
            const { username, password, origin:_origin } = new URL(i);
            const newUrl = new URL(_origin);
            if (username) newUrl.username = username;
            if (password) newUrl.password = password;
            origins.push(newUrl.href);
        });
        url = url.join(',');
        origin = origins.join(',');
    } else {
        const {username, password,  origin:_origin} = new URL(url);
        const newUrl = new URL(_origin);
        if (username) newUrl.username = username;
        if (password) newUrl.password = password;
        origin = newUrl.href;
    }
    if (!url) {
        throw new Error('At least one URL is required')
    }
    console.log('Reloading cache for', url, 'args', ['cache', '--no-lock', `--reload=${origin}`, url])
    const res = new TextDecoder()
        .decode((
            await (new Deno.Command(Deno.execPath(), { args: ['cache', '--no-lock', `--reload=${origin}`, url] })).output()
        ).stdout)
    return res
}

export default getDenoDirectories;