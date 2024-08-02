import type TS from 'typescript'

export async function typescriptTransformModulePaths(typescript: Promise<typeof TS> | typeof TS) {
  const ts = await typescript
  return function (
    code: string,
    //** Callback to modify module-declaration node. Return `false` to remove node from code. `Throw` to break execution. */
    callback: (source: string) => string | null,
  ) {
    const sourceFile = ts.createSourceFile('', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    let shouldPrint = false
    const result = ts.transform(sourceFile, [
      context => {
        const visit: TS.Visitor = node => {
          if (
            (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
            node.moduleSpecifier &&
            ts.isStringLiteral(node.moduleSpecifier)
          ) {
            const isImport = ts.isImportDeclaration(node)

            const previous = node.moduleSpecifier.text
            const result = callback(node.moduleSpecifier.text)

            if (result === null) {
              shouldPrint = true
              return
            }

            node.moduleSpecifier.text = result

            if (previous !== node.moduleSpecifier.text) {
              shouldPrint = true
              if (isImport) {
                return ts.factory.updateImportDeclaration(
                  node,
                  node.modifiers,
                  node.importClause,
                  ts.factory.createStringLiteral(result),
                  node.assertClause, // Preserve the assert clause if it exists
                )
              } else {
                return ts.factory.updateExportDeclaration(
                  node,
                  node.modifiers,
                  false,
                  node.exportClause,
                  ts.factory.createStringLiteral(result),
                  node.assertClause, // Preserve the assert clause if it exists
                )
              }
            }
          }
          return ts.visitEachChild(node, visit, context)
        }
        return node => ts.visitNode(node, visit) as TS.SourceFile
      },
    ])
    if (!result.transformed[0]) return undefined
    if (!shouldPrint) return code
    const printer = ts.createPrinter({
      newLine: ts.NewLineKind.LineFeed,
    })
    return printer.printFile(result.transformed[0])
  }
}
