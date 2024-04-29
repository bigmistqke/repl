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

export type TypeRegistryState = {
  alias: Record<string, string[]>
  sources: Record<string, string>
}

/**
 * Manages the registry of TypeScript types across the application, facilitating type definition management
 * and providing utilities for importing and resolving TypeScript definitions from various sources.
 * This class is crucial for maintaining type accuracy and enabling IntelliSense in the editor.
 *
 * @class TypeRegistry
 */
export class TypeRegistry {
  private cachedUrls = new Set<string>()
  private cachedPackageNames = new Set<string>()
  private sources: Accessor<Record<string, string>>
  private setSources: Setter<Record<string, string>>
  private alias: Accessor<Record<string, string[]>>
  private setAlias: Setter<Record<string, string[]>>

  /**
   * Initializes a new instance of the TypeRegistry class.
   *
   * @param {FileSystem} fs The file system instance that interacts with this type registry.
   */
  constructor(public fs: FileSystem) {
    ;[this.sources, this.setSources] = createSignal({}, { equals: false })
    ;[this.alias, this.setAlias] = createSignal({})
  }

  /**
   * Converts the current state of the type registry into a JSON object.
   *
   * @returns {TypeRegistryState} The current state of the type registry.
   */
  toJSON(): TypeRegistryState {
    return {
      alias: this.alias(),
      sources: this.sources(),
    }
  }

  /**
   * Initializes the registry with a predefined state, setting up known types and aliases.
   *
   * @param {TypeRegistryState} initialState The initial state to load into the registry.
   */
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

  /**
   * Imports type definitions from a URL, checking if the types are already cached before importing.
   *
   * @param {string} url The URL of the type definition to import.
   * @param {string} [packageName] The package name associated with the type definitions.
   * @returns {Promise<void>}
   * @async
   */

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

  /**
   * Imports type definitions based on a package name by resolving it to a CDN path.
   *
   * @param {string} packageName The package name whose types to import.
   * @returns {Promise<void>}
   * @async
   */
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

  /**
   * Adds or updates a path in the TypeScript configuration to map to an aliased package.
   *
   * @param {string} packageName The package name to alias.
   * @param {string} virtualPath The virtual path that the alias points to.
   * @private
   */
  private aliasPath(packageName: string, virtualPath: string) {
    // add virtual path to monaco's tsconfig's `path`-property
    const tsCompilerOptions =
      this.fs.monaco.languages.typescript.typescriptDefaults.getCompilerOptions()
    tsCompilerOptions.paths![packageName] = [`file:///node_modules/${virtualPath}`]
    this.fs.monaco.languages.typescript.typescriptDefaults.setCompilerOptions(tsCompilerOptions)
    this.fs.monaco.languages.typescript.javascriptDefaults.setCompilerOptions(tsCompilerOptions)
    this.setAlias(tsCompilerOptions.paths!)
  }

  /**
   * Adds or updates a type definition source to the registry.
   *
   * @param {string} path The path of the type definition file.
   * @param {string} value The content of the type definition file.
   * @private
   */
  private set(path: string, value: string) {
    this.setSources(files => {
      files[path] = value
      return files
    })
  }

  /**
   * Checks if a specific path is already registered in the type sources.
   *
   * @param {string} path The path to check.
   * @returns {boolean} True if the path is registered, false otherwise.
   * @private
   */
  private has(path: string) {
    return path in this.sources()
  }

  /**
   * Converts a URL into a virtual path by stripping the CDN URL and protocol.
   *
   * @param {string} url The URL to convert.
   * @returns {string} The virtual path derived from the URL.
   * @private
   */
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
}
