import type * as TS from 'typescript'

export interface ModulePathRange {
  start: number
  end: number
  path: string
  isImport: boolean
}

/**
 * Extracts all module path ranges from TypeScript source code.
 * Finds import and export declarations and returns their module specifier positions.
 *
 * @param options - Configuration for extracting ranges
 * @param options.ts - TypeScript compiler API instance
 * @param options.source - Source code to analyze
 * @returns Array of ranges containing start/end positions, module paths, and whether it's an import
 *
 * @example
 * ```typescript
 * const ranges = getModulePathRanges({
 *   ts: typescript,
 *   source: 'import { foo } from "./bar.js"'
 * });
 * // Returns: [{ start: 21, end: 30, path: "./bar.js", isImport: true }]
 * ```
 */
export function getModulePathRanges({ ts, source }: { ts: typeof TS; source: string }) {
  const sourceFile = ts.createSourceFile('', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

  const ranges: Array<ModulePathRange> = []

  const stack: Array<TS.Node> = [sourceFile]

  let node: TS.Node | undefined

  while ((node = stack.shift())) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const isImport = ts.isImportDeclaration(node)
      const text = node.moduleSpecifier.text
      const start = node.moduleSpecifier.getStart(sourceFile) + 1 // skip quote
      const end = node.moduleSpecifier.getEnd() - 1 // skip quote

      ranges.push({ start, end, path: text, isImport })
    }

    ts.forEachChild(node, child => stack.push(child))
  }

  return ranges
}
