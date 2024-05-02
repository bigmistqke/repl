import ts, { SourceFile } from 'typescript'
import { Runtime } from './runtime'

export class Transpiler {
  constructor(private runtime: Runtime) {}
  /**
   * Transforms module declarations (import/export) within a TypeScript code file, according to the provided callback function.
   * The callback can modify the nodes by returning updated nodes, or it can signal to remove nodes by returning `false`.
   * If an exception is thrown within the callback, it breaks the execution of the function.
   *
   * @param path - The path of the source file to be modified.
   * @param code - The TypeScript code as a string.
   * @param callback - Callback function to apply on each import or export declaration node. This function can return `false` to signal the removal of the node from the code, or modify the node directly. The execution is stopped if the callback throws an error.
   * @returns - The transformed code as a string. Returns `undefined` if no transformations were made to the original code or if no changes are detected.
   */
  transformModuleDeclarations(
    code: string,
    //** Callback to modify module-declaration node. Return `false` to remove node from code. `Throw` to break execution. */
    callback: (node: ts.ImportDeclaration | ts.ExportDeclaration) => void | false,
  ) {
    const typescript = this.runtime.libs.typescript
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
        const visit: ts.Visitor = node => {
          if (
            (typescript.isImportDeclaration(node) || typescript.isExportDeclaration(node)) &&
            node.moduleSpecifier &&
            typescript.isStringLiteral(node.moduleSpecifier)
          ) {
            const isImport = typescript.isImportDeclaration(node)

            const previous = node.moduleSpecifier.text

            if (callback(node) === false) {
              shouldPrint = true
              return
            }

            if (previous !== node.moduleSpecifier.text) {
              shouldPrint = true
              if (isImport) {
                return typescript.factory.updateImportDeclaration(
                  node,
                  node.modifiers,
                  node.importClause,
                  typescript.factory.createStringLiteral(node.moduleSpecifier.text),
                  node.assertClause, // Preserve the assert clause if it exists
                )
              } else {
                return typescript.factory.updateExportDeclaration(
                  node,
                  node.modifiers,
                  false,
                  node.exportClause,
                  typescript.factory.createStringLiteral(node.moduleSpecifier.text),
                  node.assertClause, // Preserve the assert clause if it exists
                )
              }
            }
          }
          return typescript.visitEachChild(node, visit, context)
        }
        return node => typescript.visitNode(node, visit) as SourceFile
      },
    ])
    if (!result.transformed[0]) return undefined
    if (!shouldPrint) return code
    const printer = typescript.createPrinter({
      newLine: typescript.NewLineKind.LineFeed,
    })
    return printer.printFile(result.transformed[0])
  }
}
