import type TS from 'typescript'
import * as PathUtils from '../path-utils.ts'
import type { FileUrlSystem } from '../types.ts'

interface Range {
  start: number
  end: number
  path: string
  isImport: boolean
}

export function transformModulePaths({
  ts,
  source,
  transform,
}: {
  ts: typeof TS
  source: string
  transform(path: string, isImport: boolean): string
}) {
  const sourceFile = ts.createSourceFile('', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

  const ranges: Array<Range> = []

  function collect(node: TS.Node) {
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

    ts.forEachChild(node, collect)
  }

  collect(sourceFile)

  return () => {
    let modified = false
    const edits: Array<{ start: number; end: number; replacement: string }> = []
    const transformedRanges: Array<Range> = []

    for (const { start, end, path, isImport } of ranges) {
      const replacement = transform(path, isImport)
      transformedRanges.push({ start, end, path, isImport })
      if (replacement !== path) {
        edits.push({ start, end, replacement })
        modified = true
      }
    }

    if (!modified) {
      return source
    }

    // Apply edits in reverse order to preserve positions
    let result = source
    for (let i = edits.length - 1; i >= 0; i--) {
      const { start, end, replacement } = edits[i]!
      result = result.slice(0, start) + replacement + result.slice(end)
    }

    return result
  }
}

export function defaultTransformModulePaths({
  fileUrls,
  compilerOptions = {},
  path,
  readFile,
  source,
  ts,
  cdn = 'https://esm.sh',
}: {
  fileUrls: FileUrlSystem
  compilerOptions?: TS.CompilerOptions
  path: string
  readFile(path: string): string | undefined
  source: string
  ts: typeof TS
  cdn?: string
}) {
  return transformModulePaths({
    ts,
    source,
    transform(modulePath) {
      if (modulePath.startsWith('.')) {
        // Swap relative module-path out with their respective module-url
        const { resolvedModule } = ts.resolveModuleName(modulePath, path, compilerOptions, {
          fileExists(path) {
            try {
              return readFile(path) !== undefined
            } catch {
              return false
            }
          },
          readFile,
        })

        if (!resolvedModule) throw `no resolved module ${path} ${modulePath}`

        const url = fileUrls.get(resolvedModule.resolvedFileName)
        if (!url) throw `url ${path} ${modulePath} ${resolvedModule.resolvedFileName} is undefined`

        return url
      } else if (PathUtils.isUrl(modulePath)) {
        // Return url directly
        return modulePath
      } else {
        // Wrap external modules with esm.sh
        return `${cdn}/${modulePath}`
      }
    },
  })
}
