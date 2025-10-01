import type TS from 'typescript'
import * as PathUtils from '../path-utils.ts'
import type { FileUrlSystem } from '../types.ts'

interface Range {
  start: number
  end: number
  path: string
  isImport: boolean
}

/**********************************************************************************/
/*                                                                                */
/*                             Get Module Path Ranges                             */
/*                                                                                */
/**********************************************************************************/

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

  const ranges: Array<Range> = []

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

/**********************************************************************************/
/*                                                                                */
/*                              Transform Module Paths                            */
/*                                                                                */
/**********************************************************************************/

/**
 * Transforms module paths in TypeScript source code by applying a custom transform function.
 *
 * @param options - Configuration for the transformation
 * @param options.ts - TypeScript compiler API instance
 * @param options.source - Source code to transform
 * @param options.transform - Function that transforms each module path
 * @returns A function that when called applies the transformations and returns the modified source
 */
export function transformModulePaths({
  ts,
  source,
  transform,
}: {
  ts: typeof TS
  source: string
  transform(path: string, isImport: boolean): string
}) {
  const ranges = getModulePathRanges({ source, ts })

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

/**********************************************************************************/
/*                                                                                */
/*                           Default Transform Module Paths                       */
/*                                                                                */
/**********************************************************************************/

/**
 * Default implementation of module path transformation for a TypeScript REPL environment.
 * Resolves relative paths to URLs, preserves existing URLs, and wraps external modules with a CDN.
 *
 * @param options - Configuration for path transformation
 * @param options.fileUrls - Map of file paths to their URLs
 * @param options.compilerOptions - TypeScript compiler options
 * @param options.path - Path of the current file being processed
 * @param options.readFile - Function to read file contents
 * @param options.source - Source code to transform
 * @param options.ts - TypeScript compiler API instance
 * @param options.cdn - CDN URL for external modules (defaults to 'https://esm.sh')
 * @returns A function that applies the transformations
 */
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
