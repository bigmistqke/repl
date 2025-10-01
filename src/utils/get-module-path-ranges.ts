import type * as TS from 'typescript'

export interface ModulePathRange {
  start: number
  end: number
  path: string
  isImport: boolean
  isDynamic?: boolean
}

export interface GetModulePathRangesOptions {
  ts: typeof TS
  source: string
  include?: {
    imports?: boolean
    exports?: boolean
    dynamicImports?: boolean
  }
}

/**
 * Extracts all module path ranges from TypeScript source code.
 * Finds import and export declarations and returns their module specifier positions.
 *
 * @param options - Configuration for extracting ranges
 * @param options.ts - TypeScript compiler API instance
 * @param options.source - Source code to analyze
 * @param options.include - Options to include/exclude specific types of imports/exports
 * @returns Array of ranges containing start/end positions, module paths, and whether it's an import
 *
 * @example
 * ```typescript
 * const ranges = getModulePathRanges({
 *   ts: typescript,
 *   source: 'import { foo } from "./bar.js"',
 *   include: { imports: true, exports: false, dynamicImports: true }
 * });
 * // Returns: [{ start: 21, end: 30, path: "./bar.js", isImport: true }]
 * ```
 */
export function getModulePathRanges({ 
  ts, 
  source, 
  include = { imports: true, exports: true, dynamicImports: true } 
}: GetModulePathRangesOptions) {
  const sourceFile = ts.createSourceFile('', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

  const ranges: Array<ModulePathRange> = []

  function collect(node: TS.Node) {
    // Handle import and export declarations
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const isImport = ts.isImportDeclaration(node)
      
      // Check if this type should be included
      if ((isImport && !include.imports) || (!isImport && !include.exports)) {
        ts.forEachChild(node, collect)
        return
      }
      
      const text = node.moduleSpecifier.text
      const start = node.moduleSpecifier.getStart(sourceFile) + 1 // skip quote
      const end = node.moduleSpecifier.getEnd() - 1 // skip quote

      ranges.push({ start, end, path: text, isImport, isDynamic: false })
    }

    // Handle dynamic imports: import('...')
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      if (!include.dynamicImports) {
        ts.forEachChild(node, collect)
        return
      }
      
      const arg = node.arguments[0]
      if (arg && ts.isStringLiteral(arg)) {
        const text = arg.text
        const start = arg.getStart(sourceFile) + 1 // skip quote
        const end = arg.getEnd() - 1 // skip quote

        ranges.push({ start, end, path: text, isImport: true, isDynamic: true })
      }
    }

    ts.forEachChild(node, collect)
  }

  collect(sourceFile)

  return ranges
}
