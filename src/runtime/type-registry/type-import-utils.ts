import { when } from 'src/utils/conditionals'
import { formatError } from 'src/utils/format-log'
import {
  isRelativePath,
  isUrl,
  pathToPackageNameAndVersion,
  relativeToAbsolutePath,
} from 'src/utils/path'
import { TypeRegistry, TypeRegistryState } from '.'
import { Runtime } from '../runtime'

export class TypeImportUtils {
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

      const transformedCode = await this.runtime.config.transformModulePaths(code, modulePath => {
        if (isRelativePath(modulePath)) {
          promises.push(resolvePath(relativeToAbsolutePath(path, modulePath)))
          if (modulePath.endsWith('.js')) {
            modulePath = modulePath.replace('.js', '.d.ts')
            return modulePath
          }
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

          promises.push(this.fromUrl(modulePath))
          this.typeRegistry.aliasPath(virtualPath, `file:///node_modules/${virtualPath}`)
          return virtualPath
        } else {
          promises.push(this.fromPackageName(modulePath))
        }
        return modulePath
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
      console.error(...formatError('no type url was found for package', packageName))
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
