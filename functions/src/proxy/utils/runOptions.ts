// permissions object, each key is a permission, and can receive either an array or a boolean
const runOptions = (customPermissions: object = {}, { config, variables, modules }): any => {

    const readWritePermissions = config.isolateType === 'subProcess'
        ? ['.']
        : [`${config.projectPath}`, `${config.projectPath}/../node_modules`, `${config.projectPath}/../../node_modules`]


    let permissions: any = {
        "deny-run": customPermissions?.['allow-run'] ? false : true,
        "allow-env": false,
        "allow-write": readWritePermissions,
        "allow-read": readWritePermissions,
        "allow-import": true,
        "allow-ffi": true,
        "allow-net": true,
        "unstable-sloppy-imports": true,
        "unstable-kv": true,
        "unstable": true,
        "no-lock": true,
        "no-prompt": true,
        "import-map": `data:application/json,${modules.template(JSON.stringify({ imports: config?.denoConfig?.imports, scope: config?.denoConfig?.scope }), variables)}`,
        ...customPermissions,
    };

    if (config.isolateType === 'subprocess') {
        permissions = Object
            .entries(permissions)
            .map(([key, value]) => {
                if (typeof value === 'undefined') return null;
                return typeof value === 'boolean' && (value === true)
                    ? `--${key}`
                    : Array.isArray(value)
                        ? `--${key}=${value.join(",")}`
                        : typeof value === 'string'
                            ? `--${key}=${value}`
                            : ''
            })
            .filter(Boolean)
    } else {
        permissions = Object
            .entries(permissions)
            .reduce((acc: any, [key, value]) => {
                if (typeof value === 'undefined') return;
                const [concession, type] = key.split('-');
                if (concession === 'allow') {
                    acc[type] = value;
                }
                // TODO: deny-{...} permission is not yet implemented in Deno webworkers permissions (as of v1.44.5)
                return acc
            }, {})
    }

    return permissions;
}

export default runOptions;