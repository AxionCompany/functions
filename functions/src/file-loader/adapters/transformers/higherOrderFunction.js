import { parse } from "npm:@typescript-eslint/typescript-estree";


export default ({ code, url }) => {


    // Parse code to AST
    const ast = parse(code, { jsx: true, loc: true, range: true });

    // HOF for wrapping as a string
    const withWrapperCode = `
const withWrapper = (name, fn) => {
  if (typeof fn !== 'function') {
    return fn;
  }
  const mod = (...args) => {
    const willUseHook = (globalThis._beforeRun || globalThis._afterRun) && mod.__requestId__;
    Object.assign(fn, mod);

    const executionId = crypto.randomUUID();
    willUseHook && globalThis._beforeRun && globalThis._beforeRun({
      url: "${url.href}",
      name,
      requestId: mod.__requestId__,
      executionId,
      properties: { ...mod },
      input: args
    });
    const startTime = Date.now();
    let result = fn(...args);
    if (result?.then) {
      result = result
        .then((resolved) => {
          const duration = Date.now() - startTime;
          willUseHook && globalThis._afterRun && globalThis._afterRun({
            url: "${url.href}",
            name,
            requestId: mod.__requestId__,
            executionId,
            duration,
            status: 'completed',
            properties: { ...mod },
            output: resolved
          });
          Object.assign(mod, fn);
          return resolved;
        }).catch((error) => {
          const duration = Date.now() - startTime;
          willUseHook && globalThis._afterRun && globalThis._afterRun({
            url: "${url.href}",
            name,
            requestId: mod.__requestId__,
            executionId,
            duration,
            status: 'failed',
            properties: { ...mod },
            output: error,
            error: true
          });
          Object.assign(mod, fn);
          throw error;
        });
    } else {
      Object.assign(mod, fn);
      const duration = Date.now() - startTime;
      willUseHook && globalThis._afterRun && globalThis._afterRun({
        url: "${url.href}",
        name,
        requestId: mod.__requestId__,
        executionId,
        duration,
        status: 'completed',
        properties: { ...mod },
        output: result
      });
    }
    return result
  }
  return mod
};
`;

    // Collect all export declarations
    const exportsList = [];

    // Helper function to get code slice
    const getCodeSlice = (node) => code.slice(node.range[0], node.range[1]);
    let i = 0;

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
                    // Generate an import statement for the original module
                    let importStatement;
                    let localName = specifier.local.name;
                    if (node.source) {
                        if ('default' === localName) {
                            localName = `_${localName}_${i}`;
                            i++;
                        }
                        const importedModulePath = node.source.value;
                        // Generate an import statement for the original module
                        importStatement = `import ${localName} from '${importedModulePath}';`;
                    }
                    if (specifier.exported.name !== specifier.local.name) {
                        exportsList.push({
                            key: specifier.exported.name,
                            value: `withWrapper("${specifier.exported.name}",${localName})`,
                            importStatement
                        });
                    } else {
                        exportsList.push({
                            key: `___${specifier.exported.name}___`,
                            value: `withWrapper("${specifier.exported.name}",${localName})`,
                            as: specifier.exported.name,
                            importStatement
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
        ...ast?.body?.map(removeExportDeclarations),
        ...exportsList.map(e => e.importStatement).filter(Boolean),
        withWrapperCode,
        declarationStatements,
        newExportStatement,
    ]?.filter(Boolean)?.join('\n');

    return transformedCode;

}
