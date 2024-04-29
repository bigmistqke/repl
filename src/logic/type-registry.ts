import * as ts from 'typescript'

import { Accessor, Setter, batch, createSignal } from 'solid-js'
import {
  isRelativePath,
  isUrl,
  mapModuleDeclarations,
  pathToPackageNameAndVersion,
  relativeToAbsolutePath,
  when,
} from '../utils'
import { FileSystem } from './file-system'
import { PackageJsonParser } from './package-json'

export type TypeRegistryState = {
  alias: Record<string, string[]>
  sources: Record<string, string>
}

export class TypeRegistry {
  private sources: Accessor<Record<string, string>>
  private setSources: Setter<Record<string, string>>
  private alias: Accessor<Record<string, string[]>>
  private setAlias: Setter<Record<string, string[]>>
  packageJson = new PackageJsonParser()

  constructor(public fs: FileSystem) {
    ;[this.sources, this.setSources] = createSignal({}, { equals: false })
    ;[this.alias, this.setAlias] = createSignal({})
  }

  toJSON(): TypeRegistryState {
    return {
      alias: this.alias(),
      sources: this.sources(),
    }
  }

  initialize(initialState: TypeRegistryState) {
    batch(() => {
      this.setSources(initialState.sources)
      this.setAlias(initialState.alias)

      Object.entries(initialState.sources).forEach(([key, value]) => {
        this.cachedUrls.add(key)
        if (value) {
          this.fs.monaco.languages.typescript.typescriptDefaults.addExtraLib(
            value,
            `file:///node_modules/${key}`,
          )
        }
      })

      Object.entries(initialState.alias).forEach(([key, value]) => {
        this.cachedPackageNames.add(key)
        // add virtual path to monaco's tsconfig's `path`-property
        const tsCompilerOptions =
          this.fs.monaco.languages.typescript.typescriptDefaults.getCompilerOptions()
        tsCompilerOptions.paths![key] = value
        this.fs.monaco.languages.typescript.typescriptDefaults.setCompilerOptions(tsCompilerOptions)
        this.fs.monaco.languages.typescript.javascriptDefaults.setCompilerOptions(tsCompilerOptions)
      })
    })
  }

  aliasPath(packageName: string, virtualPath: string) {
    // add virtual path to monaco's tsconfig's `path`-property
    const tsCompilerOptions =
      this.fs.monaco.languages.typescript.typescriptDefaults.getCompilerOptions()
    tsCompilerOptions.paths![packageName] = [`file:///node_modules/${virtualPath}`]
    this.fs.monaco.languages.typescript.typescriptDefaults.setCompilerOptions(tsCompilerOptions)
    this.fs.monaco.languages.typescript.javascriptDefaults.setCompilerOptions(tsCompilerOptions)
    this.setAlias(tsCompilerOptions.paths!)
  }

  private set(path: string, value: string) {
    this.setSources(files => {
      files[path] = value
      return files
    })
  }

  private has(path: string) {
    return path in this.sources()
  }

  private getVirtualPath(url: string) {
    return (
      url
        .replace(`${this.fs.config.cdn}/`, '')
        .replace('http://', '')
        // replace version-number
        .split('/')
        .slice(1)
        .join('/')
    )
  }

  private cachedUrls = new Set<string>()
  async importTypesFromUrl(url: string, packageName?: string) {
    const virtualPath = this.getVirtualPath(url)

    if (
      (packageName && this.cachedPackageNames.has(packageName)) ||
      this.cachedUrls.has(virtualPath)
    ) {
      return
    }
    this.cachedUrls.add(virtualPath)
    if (packageName) {
      this.cachedPackageNames.add(packageName)
    }

    const newFiles: Record<string, string> = {}

    const resolvePath = async (path: string) => {
      const virtualPath = this.getVirtualPath(path)
      if (this.has(virtualPath)) return

      // Set file to 'null' to prevent re-fetching.
      this.set(virtualPath, null!)

      const code = await fetch(path).then(response => {
        if (response.status !== 200) {
          // throw new Error(`Error while loading ${url}`)
        }
        return response.text()
      })

      const promises: Promise<void>[] = []

      const transformedCode = mapModuleDeclarations(virtualPath, code, node => {
        const specifier = node.moduleSpecifier as ts.StringLiteral
        let modulePath = specifier.text
        if (isRelativePath(modulePath)) {
          if (modulePath.endsWith('.js')) {
            modulePath = modulePath.replace('.js', '.d.ts')
            specifier.text = modulePath
          }
          promises.push(resolvePath(relativeToAbsolutePath(path, modulePath)))
        } else if (isUrl(modulePath)) {
          let virtualPath = this.getVirtualPath(modulePath)
          when(pathToPackageNameAndVersion(virtualPath))(([packageName, version]) => {
            for (const key of Object.keys(this.sources())) {
              const foundSamePackageName = when(pathToPackageNameAndVersion(key))(([
                otherPackagename,
                otherVersion,
              ]) => {
                if (otherPackagename === packageName) {
                  if (version !== otherVersion) {
                    console.warn(
                      `Conflicting version numbers: Overwriting version number of ${packageName} from ${version} to ${otherVersion}.\nAccessed ${modulePath} from ${path}.`,
                    )
                    modulePath = modulePath.replace(version, otherVersion)
                    virtualPath = virtualPath.replace(version, otherVersion)
                  }
                  return true
                }
                return false
              })
              if (foundSamePackageName) {
                break
              }
            }
          })

          specifier.text = virtualPath
          promises.push(this.importTypesFromUrl(modulePath))
          this.aliasPath(virtualPath, virtualPath)
        } else {
          promises.push(this.importTypesFromPackageName(modulePath))
        }
      })

      if (!transformedCode) {
        throw new Error(`Transform returned undefined for ${virtualPath}`)
      }

      await Promise.all(promises)

      // Set file to its contents.
      this.set(virtualPath, transformedCode)
      newFiles[virtualPath] = transformedCode
    }

    await resolvePath(url)

    Object.entries(newFiles).forEach(([key, value]) => {
      if (value) {
        this.fs.monaco.languages.typescript.typescriptDefaults.addExtraLib(
          value,
          `file:///node_modules/${key}`,
        )
      }
    })

    if (packageName) {
      this.cachedPackageNames.add(packageName)
      this.aliasPath(packageName, virtualPath)
    }
  }

  private cachedPackageNames = new Set<string>()
  async importTypesFromPackageName(packageName: string) {
    if (this.cachedPackageNames.has(packageName)) return
    this.cachedPackageNames.add(packageName)

    const typeUrl = await fetch(`${this.fs.config.cdn}/${packageName}`)
      .then(result => result.headers.get('X-TypeScript-Types'))
      .catch(error => {
        console.info(error)
        return undefined
      })

    if (!typeUrl) {
      console.error('no type url was found for package', packageName)
      return
    }

    const virtualPath = this.getVirtualPath(typeUrl)

    await this.importTypesFromUrl(typeUrl)

    this.aliasPath(packageName, virtualPath)
  }
}
