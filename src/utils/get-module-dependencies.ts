import * as TS from 'typescript'
import { getModulePathRanges, type ModulePathRange } from './get-module-path-ranges.ts'
import { resolvePath } from './path-utils.ts'

export interface GetModuleDependenciesOptions {
  entry: string
  readFile(path: string): Promise<string>
  ts: typeof TS
  include?: {
    imports?: boolean
    exports?: boolean
    dynamicImports?: boolean
  }
}

export interface ModuleDependencies {
  local: Record<string, string>
  external: string[]
}

/**
 * Analyzes a TypeScript/JavaScript module and its dependencies to extract all local files and external packages.
 *
 * This function recursively walks through a module's dependency tree, starting from an entry point,
 * and collects:
 * - **Local dependencies**: Relative imports (files with content)
 * - **External dependencies**: Package names and URLs (npm packages, CDN URLs, etc.)
 *
 * @param options - Configuration for dependency analysis
 * @param options.entry - The entry file path to start analysis from
 * @param options.readFile - Async function to read file contents by path
 * @param options.ts - TypeScript compiler API instance
 * @param options.include - Optional filters for which types of imports/exports to include
 * @param options.include.imports - Include static import statements (default: true)
 * @param options.include.exports - Include export re-export statements (default: true)
 * @param options.include.dynamicImports - Include dynamic import() calls (default: true)
 *
 * @returns Promise resolving to an object containing local files with their content and external dependency names
 *
 * @example
 * ```typescript
 * import * as ts from 'typescript'
 * import { getModuleDependencies } from './get-module-dependencies'
 *
 * const result = await getModuleDependencies({
 *   entry: 'src/index.ts',
 *   readFile: async (path) => await fs.readFile(path, 'utf-8'),
 *   ts
 * })
 *
 * console.log('Local files:', Object.keys(result.local))
 * // => ['src/index.ts', 'src/utils.ts', 'src/components/Button.ts']
 *
 * console.log('External packages:', result.external)
 * // => ['react', 'lodash', '@mui/material']
 * ```
 *
 * @example
 * ```typescript
 * // Only analyze static imports, exclude exports and dynamic imports
 * const result = await getModuleDependencies({
 *   entry: 'app.ts',
 *   readFile,
 *   ts,
 *   include: {
 *     imports: true,
 *     exports: false,
 *     dynamicImports: false
 *   }
 * })
 * ```
 *
 * @example
 * ```typescript
 * // Example input file content:
 * // src/index.ts:
 * //   import React from 'react'
 * //   import { helper } from './utils.ts'
 * //   const dynamic = await import('lodash')
 * //   export { Button } from '@mui/material'
 *
 * const result = await getModuleDependencies({
 *   entry: 'src/index.ts',
 *   readFile,
 *   ts
 * })
 *
 * // Result:
 * // {
 * //   local: {
 * //     'src/index.ts': '...file content...',
 * //     'src/utils.ts': '...file content...'
 * //   },
 * //   external: ['react', 'lodash', '@mui/material']
 * // }
 * ```
 */
export async function getModuleDependencies({
  entry,
  readFile,
  ts,
  include = { imports: true, exports: true, dynamicImports: true },
}: GetModuleDependenciesOptions): Promise<ModuleDependencies> {
  const visitedPaths = new Set<string>()
  const local: Record<string, string> = {}
  const packages = new Set<string>()

  async function walk({ path, ranges }: { path: string; ranges: Array<ModulePathRange> }) {
    await Promise.all(
      ranges.map(async range => {
        if (!range.path.startsWith('.')) {
          packages.add(range.path)

          return
        }
        const resolvedPath = resolvePath(path, range.path)

        if (visitedPaths.has(resolvedPath)) {
          return
        }

        visitedPaths.add(resolvedPath)
        const source = await readFile(resolvedPath)
        local[resolvedPath] = source
        const ranges = getModulePathRanges({ source, ts, include })

        await walk({ path: resolvedPath, ranges })
      }),
    )
  }

  const source = await readFile(entry)
  const ranges = getModulePathRanges({ source, ts, include })
  local[entry] = source

  await walk({ path: entry, ranges })

  return { local, external: Array.from(packages) }
}
