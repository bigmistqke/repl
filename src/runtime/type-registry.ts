import type ts from 'typescript'

import { batch } from 'solid-js'
import { SetStoreFunction, createStore } from 'solid-js/store'
import { when } from '../utils/conditionals'
import {
  isRelativePath,
  isUrl,
  pathToPackageNameAndVersion,
  relativeToAbsolutePath,
} from '../utils/path'
import { Runtime } from './runtime'

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
  sources: Record<string, string>
  private setSources: SetStoreFunction<Record<string, string>>
  alias: Record<string, string[]>
  private setAlias: SetStoreFunction<Record<string, string[]>>
  import: TypeImports

  /**
   * Initializes a new instance of the TypeRegistry class.
   *
   * @param runtime The repl-instance that interacts with this type registry.
   */
  constructor(public runtime: Runtime) {
    ;[this.sources, this.setSources] = createStore({})
    ;[this.alias, this.setAlias] = createStore({})
    this.import = new TypeImports(runtime, this)
  }

  /**
   * Converts the current state of the type registry into a JSON object.
   *
   * @returns The current state of the type registry.
   */
  toJSON(): TypeRegistryState {
    return {
      alias: this.alias,
      sources: this.sources,
    }
  }

  /**
   * Initializes the registry with a predefined state, setting up known types and aliases.
   *
   * @param initialState The initial state to load into the registry.
   */
  initialize(initialState: Partial<TypeRegistryState>) {
    batch(() => {
      if (initialState.sources) {
        this.setSources(initialState.sources)
      }
      if (initialState.alias) {
        this.setAlias(initialState.alias)
        Object.entries(initialState.alias).forEach(([key, value]) => {
          this.aliasPath(key, value[0]!)
        })
      }
    })
    this.import.initialize(initialState)
  }

  /**
   * Adds or updates a path in the TypeScript configuration to map to an aliased package.
   *
   * @param packageName The package name to alias.
   * @param virtualPath The virtual path that the alias points to.
   * @private
   */
  aliasPath(packageName: string, virtualPath: string) {
    this.setAlias(packageName, [virtualPath])
  }

  /**
   * Adds or updates a type definition source to the registry.
   *
   * @param path The path of the type definition file.
   * @param value The content of the type definition file.
   * @private
   */
  set(path: string, value: string) {
    this.setSources(path, value)
  }

  /**
   * Checks if a specific path is already registered in the type sources.
   *
   * @param path The path to check.
   * @returns True if the path is registered, false otherwise.
   * @private
   */
  has(path: string) {
    return path in this.sources
  }
}

class TypeImports {
  private cachedUrls = new Set<string>()
  private cachedPackageNames = new Set<string>()

  constructor(
    public runtime: Runtime,
    public typeRegistry: TypeRegistry,
  ) {}

  initialize(initialState: Partial<TypeRegistryState>) {
    if (initialState.sources) {
      Object.keys(initialState.sources).forEach(key => {
        this.cachedUrls.add(key)
      })
    }
    if (initialState.alias) {
      Object.entries(initialState.alias).forEach(([key]) => {
        this.cachedPackageNames.add(key)
      })
    }
  }

  /**
   * Imports type definitions from a URL, checking if the types are already cached before importing.
   *
   * @param url The URL of the type definition to import.
   * @param [packageName] The package name associated with the type definitions.
   * @returns
   * @async
   */
  async fromUrl(url: string, packageName?: string) {
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

    const resolvePath = async (path: string) => {
      const virtualPath = this.getVirtualPath(path)
      if (this.typeRegistry.has(virtualPath)) return

      // Set file to 'null' to prevent re-fetching.
      this.typeRegistry.set(virtualPath, null!)

      const code = await fetch(path).then(response => {
        if (response.status !== 200) {
          // throw new Error(`Error while loading ${url}`)
        }
        return response.text()
      })

      const promises: Promise<void>[] = []

      const transformedCode = this.runtime.utils.mapModuleDeclarations(virtualPath, code, node => {
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
          when(pathToPackageNameAndVersion(virtualPath), ([packageName, version]) => {
            for (const key of Object.keys(this.typeRegistry.sources)) {
              const foundSamePackageName = when(
                pathToPackageNameAndVersion(key),
                ([otherPackagename, otherVersion]) => {
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
                },
              )
              if (foundSamePackageName) {
                break
              }
            }
          })

          specifier.text = virtualPath
          promises.push(this.fromUrl(modulePath))
          this.typeRegistry.aliasPath(virtualPath, `file:///node_modules/${virtualPath}`)
        } else {
          promises.push(this.fromPackageName(modulePath))
        }
      })

      if (!transformedCode) {
        throw new Error(`Transform returned undefined for ${virtualPath}`)
      }

      await Promise.all(promises)

      // Set file to its contents.
      this.typeRegistry.set(virtualPath, transformedCode)
    }

    await resolvePath(url)

    if (packageName) {
      this.cachedPackageNames.add(packageName)
      this.typeRegistry.aliasPath(packageName, `file:///node_modules/${virtualPath}`)
    }
  }

  /**
   * Imports type definitions based on a package name by resolving it to a CDN path.
   *
   * @param packageName The package name whose types to import.
   * @returns
   * @async
   */
  async fromPackageName(packageName: string) {
    if (this.cachedPackageNames.has(packageName)) return
    this.cachedPackageNames.add(packageName)

    const typeUrl = await fetch(`${this.runtime.config.cdn}/${packageName}`)
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

    await this.fromUrl(typeUrl)

    this.typeRegistry.aliasPath(packageName, `file:///node_modules/${virtualPath}`)
  }

  /**
   * Converts a URL into a virtual path by stripping the CDN URL and protocol.
   *
   * @param url The URL to convert.
   * @returns The virtual path derived from the URL.
   * @private
   */
  private getVirtualPath(url: string) {
    return (
      url
        .replace(`${this.runtime.config.cdn}/`, '')
        .replace('http://', '')
        // replace version-number
        .split('/')
        .slice(1)
        .join('/')
    )
  }
}
