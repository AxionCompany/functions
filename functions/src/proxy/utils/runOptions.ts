// permissions object, each key is a permission, and can receive either an array or a boolean
const runOptions = (customPermissions: object = {}, { config, variables, modules }): string[] => {

    const permissionsObj = {
        "deny-run": true,
        "allow-env": ["DENO_DIR", "DENO_AUTH_TOKENS"],
        "allow-sys": ["cpus", "osRelease"],
        "allow-write": [`.`],
        "allow-read": [`.`],
        "allow-net": true,
        "allow-ffi": true,
        "unstable-sloppy-imports": true,
        "unstable-kv": true,
        "unstable": true,
        "no-lock": true,
        "no-prompt": true,
        ...customPermissions,
        "import-map": `data:application/json,${modules.template(JSON.stringify({ imports: config?.denoConfig?.imports, scope: config?.denoConfig?.scope }), variables)}`,
    };

    const permissions = Object
        .entries(permissionsObj)
        .map(([key, value]) => {
            return typeof value === 'boolean' && (value === true)
                ? `--${key}`
                : Array.isArray(value)
                    ? `--${key}=${value.join(",")}`
                    : typeof value === 'string'
                        ? `--${key}=${value}`
                        : ''
        })
        .filter(Boolean)

    return permissions;
}

export default runOptions;