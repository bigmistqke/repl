import type TS from 'typescript'
import type { FileUrlSystem } from '../types.ts'
import { getModulePathRanges, type ModulePathRange } from './get-module-path-ranges.ts'
import * as PathUtils from './path-utils.ts'

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
    const transformedRanges: Array<ModulePathRange> = []

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
