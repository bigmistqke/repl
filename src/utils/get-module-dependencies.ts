import * as TS from 'typescript'
import { getModulePathRanges, type ModulePathRange } from './get-module-path-ranges.ts'
import { resolvePath } from './path-utils.ts'

export interface GetModuleFilesOptions {
  entry: string
  readFile(path: string): Promise<string>
  ts: typeof TS
  include?: {
    imports?: boolean
    exports?: boolean
    dynamicImports?: boolean
  }
}

export async function getModuleDependencies({
  entry,
  readFile,
  ts,
  include = { imports: true, exports: true, dynamicImports: true },
}: GetModuleFilesOptions) {
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
