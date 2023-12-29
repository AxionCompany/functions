import * as parser from "https://esm.sh/@babel/parser";
import traverse from "https://esm.sh/@babel/traverse";

interface ImportDetails {
  source?: string;
  specifiers?: {
    type: string;
    importedName?: string;
    exportedName?: string;
    localName: string;
  }[];
}

interface ExportDetails {
  exportedName: string;
  localName: string;
  type: string;
}

const esmCodeParser = (
  code: string,
): { imports: ImportDetails[]; exports: ExportDetails[]; code: string } => {
  const imports: ImportDetails[] = [];
  const exports: ExportDetails[] = [];

  // Parse the code into an AST with Babel Parser
  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: "module",
      plugins: ["classProperties"], // Enable parsing of class properties
    });
  } catch (err) {
    console.log(err);
  }
  let newCode = code;

  // Function to walk through parse tree
  traverse(ast, {
    CallExpression({ node }: any) {
        if (node.callee.type === 'Import' && node.arguments && node.arguments[0]) {
          const newDynamicImport = {
            source: node.arguments[0].value,
            specifiers: [{
              type: 'dynamic',
              importedName: 'all',
              localName: 'all'}],
          };
          newCode = newCode.replace(code.slice(node.start, node.end), '').trim();
          imports.push(newDynamicImport);
        }
      },
    ImportDeclaration({ node }: any) {
      const specifiers = node.specifiers.map((specifier: any) => {
        const type = specifier.type === "ImportDefaultSpecifier"
          ? "default"
          : specifier.type === "ImportSpecifier"
          ? "named"
          : specifier.type === "ImportNamespaceSpecifier"
          ? "all"
          : "none";

        const importedName = specifier.imported
          ? specifier.imported.name
          : specifier.type === "ImportNamespaceSpecifier"
          ? "*"
          : "default";

        return {
          type,
          importedName,
          localName: specifier.local.name,
        };
      });

      if (!specifiers.length) {
        specifiers.push({
          type: "unspecified",
          importedName: "none",
          localName: "none",
        });
      }

      imports.push({
        source: node.source.value,
        specifiers,
      });
      newCode = newCode.replace(
        code.slice(node.start, node.end),
        "",
      ).trim();
    },
    ExportNamedDeclaration({ node }: any) {
      node.specifiers.forEach((specifier: any) => {
        exports.push({
          type: "named",
          exportedName: specifier.exported.name,
          localName: specifier.local.name,
        });
      });

      newCode = newCode.replace(
        code.slice(node.start, node.end),
        "",
      ).trim();
    },
    ExportDefaultDeclaration({ node }: any) {
      exports.push({
        type: "default",
        exportedName: "default",
        localName: node.declaration.name || "[Anonymous]",
      });

      newCode = newCode.replace(
        code.slice(node.start, node.end),
        "",
      ).trim();
    },
  });

  return { imports, exports, code: newCode };
};

export default esmCodeParser;
