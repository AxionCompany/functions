import { parse } from "npm:@typescript-eslint/typescript-estree";


export default (config, modules) => ({ __requestId__, code, url, beforeRun, afterRun }) => {


    // Parse code to AST
    const ast = parse(code, { jsx: true, loc: true, range: true });

    // HOF for wrapping as a string
    const withWrapperCode = `
const withWrapper = (name,fn) => {
  if (typeof fn !== 'function') {
    return fn;
  }
  const mod = (...args) => {
    const executionId = crypto.randomUUID();
    Object.assign(fn, mod)
    _beforeRun && _beforeRun({url:"${url.href}",name, requestId:"${__requestId__}", executionId, mod:fn, ...mod}, ...args);
    const startTime = Date.now();
    let result = fn(...args);
    if (_afterRun){
        if (result?.then) {
          result = result.then((resolved) => {
            const duration = Date.now() - startTime;
            _afterRun({url:"${url.href}",name, duration, requestId:"${__requestId__}", executionId, mod:fn, ...mod}, resolved);
            return resolved;
          });
        } else {
          const duration = Date.now() - startTime;
          _afterRun({url:"${url.href}",name, duration, requestId:"${__requestId__}", executionId, mod:fn, ...mod},result);
        }
    }
    return result
  }
  return mod
};
`;

    // Collect all export declarations
    let exportsList = [];

    // Helper function to get code slice
    const getCodeSlice = (node) => code.slice(node.range[0], node.range[1]);

    // Traverse AST to collect export declarations
    ast.body.forEach((node) => {
        if (node.type === 'ExportNamedDeclaration') {
            if (node.declaration) {
                if (node.declaration.type === 'FunctionDeclaration') {
                    if (node.declaration.id.name !== getCodeSlice(node.declaration)) {
                        exportsList.push({
                            key: node.declaration.id.name,
                            value: `withWrapper("${node.declaration.id.name}",${getCodeSlice(node.declaration)})`,
                        });
                    }
                } else if (node.declaration.type === 'VariableDeclaration') {
                    node.declaration.declarations.forEach((decl) => {
                        if (decl.id.name !== getCodeSlice(decl.init).trim()) {
                            exportsList.push({
                                key: decl.id.name,
                                value: `withWrapper("${decl.id.name}",${getCodeSlice(decl.init)})`,
                            });
                        }
                    });
                }
            } else if (node.specifiers) {
                node.specifiers.forEach((specifier) => {
                    if (specifier.exported.name !== specifier.local.name) {
                        exportsList.push({
                            key: specifier.exported.name,
                            value: `withWrapper("${specifier.exported.name}",${specifier.local.name})`,
                        });
                    } else {
                        exportsList.push({
                            key: `___${specifier.exported.name}___`,
                            value: `withWrapper("${specifier.exported.name}",${specifier.local.name})`,
                            as: specifier.exported.name
                        });
                    }
                });
            }
        } else if (node.type === 'ExportDefaultDeclaration') {
            exportsList.push({
                key: '___default___',
                value: `withWrapper("${node?.declaration?.name?.toString() || 'default'}",${getCodeSlice(node.declaration)})`,
                as: 'default'
            });
        }
    });

    // Create the new export statement, except default export
    const declarationStatements = exportsList.map(e => (`const ${e.key}= ${e.value}`)).filter(Boolean).join('\n');
    const newExportStatement = `export { ${exportsList.map(e => e.key !== 'default' && `${e.key} as ${e.as || e.key}`).filter(Boolean).join(', ')}}`;

    // Remove original export declarations
    const removeExportDeclarations = (node) => {
        if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') {
            return '';
        }
        return getCodeSlice(node);
    };

    const transformedCode = [
        `const _beforeRun = ${beforeRun}`,
        `const _afterRun = ${afterRun}`,
        withWrapperCode,
        ...ast?.body?.map(removeExportDeclarations),
        declarationStatements,
        newExportStatement,
    ]?.filter(Boolean)?.join('\n');

    return transformedCode;

}


