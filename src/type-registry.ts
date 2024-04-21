import * as ts from 'typescript'

import { Monaco } from '@monaco-editor/loader'
import { PackageJsonParser } from './package-json'
import { mapModuleDeclarations } from './utils'

const regex = {
  import:
    // /import\s+(?:type\s+)?(?:\{[^}]*\}|\* as [^\s]+|\w+\s*,\s*\{[^}]*\}|\w+)?\s+from\s*"(.+?)";?/gs,
    /import\s+(?:type\s+)?(?:\{[^}]*\}|\* as [^\s]+|\w+\s*,\s*\{[^}]*\}|\w+)?\s+from\s*['"](.+?)['"];?/gs,
  export:
    // /export\s+(?:\{[^}]*\}|\* as [^\s]+|\*|\w+(?:,\s*\{[^}]*\})?|type \{[^}]*\})?\s+from\s*"(.+?)";?/gs,
    /export\s+(?:\{[^}]*\}|\* as [^\s]+|\*|\w+(?:,\s*\{[^}]*\})?|type \{[^}]*\})?\s+from\s*['"](.+?)['"];?/gs,
  require:
    // /require\s*\(["']([^"']+)["']\)/g,
    /require\s*\(["']([^"']+)["']\)/g,
}

export class TypeRegistry {
  filesystem: Record<string, string> = {}
  cachedUrls = new Set<string>()
  cachedPackageNames = new Set<string>()
  packageJson = new PackageJsonParser()

  alias = {}

  constructor(
    public monaco: Monaco,
    /**
     * Url to cdn. Response needs to return `X-Typescript-Types`-header. Defaults to `https://esm.sh`
     * */
    public cdn = 'https://esm.sh',
  ) {}

  private updateFile(path: string, value: string) {
    this.filesystem[path] = value
  }

  private checkIfPathExists(path: string) {
    return path in this.filesystem
  }

  private relativeToAbsolutePath(currentPath: string, relativePath: string) {
    const ancestorCount = relativePath.match(/\.\.\//g)?.length || 0

    const newPath =
      ancestorCount > 0
        ? [
            ...currentPath.split('/').slice(0, -(ancestorCount + 1)),
            ...relativePath.split('/').slice(ancestorCount),
          ]
        : [...currentPath.split('/').slice(0, -1), ...relativePath.split('/').slice(1)]

    return newPath.join('/')
  }

  private getVirtualPath(url: string) {
    return (
      url
        .replace(`${this.cdn}/`, '')
        .replace('http://', '')
        // replace version-number
        .split('/')
        .slice(1)
        .join('/')
    )
  }

  async importTypesFromUrl(url: string) {
    if (this.cachedUrls.has(url)) return
    this.cachedUrls.add(url)

    const newFiles: Record<string, string> = {}

    const resolvePath = async (url: string) => {
      const virtualPath = this.getVirtualPath(url)
      if (this.checkIfPathExists(virtualPath)) return

      this.updateFile(virtualPath, null!) // Simulating 'null' to prevent refetching

      const code = await fetch(url).then(response => {
        if (response.status !== 200) {
          throw new Error(`Error while loading ${url}`)
        }
        return response.text()
      })

      const promises: Promise<void>[] = []

      const transformedCode = mapModuleDeclarations(virtualPath, code, node => {
        const specifier = node.moduleSpecifier as ts.StringLiteral
        if (specifier.text.startsWith('.')) {
          promises.push(resolvePath(this.relativeToAbsolutePath(url, specifier.text)))
        } else if (specifier.text.startsWith('https:')) {
          promises.push(this.importTypesFromUrl(specifier.text))
        } else {
          promises.push(this.importTypesFromPackageName(specifier.text))
        }
      })

      if (!transformedCode) {
        throw new Error(`Transform returned undefined for ${virtualPath}`)
      }

      await Promise.all(promises)

      this.updateFile(virtualPath, transformedCode)
      newFiles[virtualPath] = transformedCode
    }

    await resolvePath(url)

    Object.entries(newFiles).forEach(([key, value]) => {
      if (value) {
        this.monaco.languages.typescript.typescriptDefaults.addExtraLib(
          value,
          `file:///.types/${key}`,
        )
      }
    })
  }

  async importTypesFromPackageName(packageName: string) {
    if (this.cachedPackageNames.has(packageName)) return
    this.cachedPackageNames.add(packageName)

    const typeUrl = await fetch(`${this.cdn}/${packageName}`).then(result =>
      result.headers.get('X-TypeScript-Types'),
    )

    if (!typeUrl) {
      console.error('no type url was found for package', packageName)
      return
    }

    const virtualPath = this.getVirtualPath(typeUrl)

    // await this.importTypesFromUrl(typeUrl)
    await this.importTypesFromUrl(typeUrl)

    // add virtual path to monaco's tsconfig's `path`-property
    const tsCompilerOptions =
      this.monaco.languages.typescript.typescriptDefaults.getCompilerOptions()
    tsCompilerOptions.paths![packageName] = [`file:///.types/${virtualPath}`]
    this.monaco.languages.typescript.typescriptDefaults.setCompilerOptions(tsCompilerOptions)
    this.monaco.languages.typescript.javascriptDefaults.setCompilerOptions(tsCompilerOptions)
  }
}
