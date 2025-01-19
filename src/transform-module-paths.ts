import typescript from 'typescript'

export function transformModulePaths(
  code: string,
  callback: (path: string, isImport: boolean) => string | null,
) {
  const sourceFile = typescript.createSourceFile(
    '',
    code,
    typescript.ScriptTarget.Latest,
    true,
    typescript.ScriptKind.TS,
  )
  let shouldPrint = false
  const result = typescript.transform(sourceFile, [
    context => {
      const visit: typescript.Visitor = node => {
        if (
          (typescript.isImportDeclaration(node) || typescript.isExportDeclaration(node)) &&
          node.moduleSpecifier &&
          typescript.isStringLiteral(node.moduleSpecifier)
        ) {
          const isImport = typescript.isImportDeclaration(node)

          const previous = node.moduleSpecifier.text
          const result = callback(node.moduleSpecifier.text, isImport)

          if (result === null) {
            shouldPrint = true
            return
          }

          node.moduleSpecifier.text = result

          if (previous !== node.moduleSpecifier.text) {
            shouldPrint = true
            if (isImport) {
              return typescript.factory.updateImportDeclaration(
                node,
                node.modifiers,
                node.importClause,
                typescript.factory.createStringLiteral(result),
                node.assertClause, // Preserve the assert clause if it exists
              )
            } else {
              return typescript.factory.updateExportDeclaration(
                node,
                node.modifiers,
                false,
                node.exportClause,
                typescript.factory.createStringLiteral(result),
                node.assertClause, // Preserve the assert clause if it exists
              )
            }
          }
        }
        return typescript.visitEachChild(node, visit, context)
      }
      return node => typescript.visitNode(node, visit) as typescript.SourceFile
    },
  ])
  if (!result.transformed[0]) return undefined
  if (!shouldPrint) return code
  const printer = typescript.createPrinter({
    newLine: typescript.NewLineKind.LineFeed,
  })
  return printer.printFile(result.transformed[0])
}
