import * as ts from 'typescript'

import { Monaco } from '@monaco-editor/loader'
import { Accessor, Setter, createSignal, mergeProps } from 'solid-js'
import {
  Mandatory,
  isRelativePath,
  isUrl,
  mapModuleDeclarations,
  pathToPackageNameAndVersion,
  relativeToAbsolutePath,
  when,
} from '../utils'
import { PackageJsonParser } from './package-json'

export type TypeRegistryState = {
  paths: Record<string, string[]>
  files: Record<string, string>
}
export type TypeRegistryConfig = Partial<{ cdn: string; initialState: TypeRegistryState }>

export class TypeRegistry {
  private files: Accessor<Record<string, string>>
  private setFiles: Setter<Record<string, string>>
  private paths: Accessor<Record<string, string[]>>
  private setPaths: Setter<Record<string, string[]>>
  packageJson = new PackageJsonParser()
  config: Mandatory<TypeRegistryConfig, 'cdn'>

  constructor(
    public monaco: Monaco,
    /**
     * Url to cdn. Response needs to return `X-Typescript-Types`-header. Defaults to `https://esm.sh`
     * */
    props: TypeRegistryConfig,
  ) {
    this.config = mergeProps({ cdn: 'https://esm.sh' }, props)
    const [files, setFiles] = createSignal({}, { equals: false })
    this.files = files
    this.setFiles = setFiles

    const [paths, setPaths] = createSignal({})
    this.paths = paths
    this.setPaths = setPaths

    if (props.initialState) {
      this.initialize(props.initialState)
    }
  }

  toJSON(): TypeRegistryState {
    return {
      paths: this.paths(),
      files: this.files(),
    }
  }

  initialize(initialState: TypeRegistryState) {
    this.setFiles(initialState.files)
    this.setPaths(initialState.paths)

    Object.entries(initialState.files).forEach(([key, value]) => {
      this.cachedUrls.add(key)
      if (value) {
        this.monaco.languages.typescript.typescriptDefaults.addExtraLib(
          value,
          `file:///.types/${key}`,
        )
      }
    })

    Object.entries(initialState.paths).forEach(([key, value]) => {
      this.cachedPackageNames.add(key)
      // add virtual path to monaco's tsconfig's `path`-property
      const tsCompilerOptions =
        this.monaco.languages.typescript.typescriptDefaults.getCompilerOptions()
      tsCompilerOptions.paths![key] = value
      this.monaco.languages.typescript.typescriptDefaults.setCompilerOptions(tsCompilerOptions)
      this.monaco.languages.typescript.javascriptDefaults.setCompilerOptions(tsCompilerOptions)
    })
  }

  alias(packageName: string, virtualPath: string) {
    // add virtual path to monaco's tsconfig's `path`-property
    const tsCompilerOptions =
      this.monaco.languages.typescript.typescriptDefaults.getCompilerOptions()
    tsCompilerOptions.paths![packageName] = [`file:///.types/${virtualPath}`]
    this.monaco.languages.typescript.typescriptDefaults.setCompilerOptions(tsCompilerOptions)
    this.monaco.languages.typescript.javascriptDefaults.setCompilerOptions(tsCompilerOptions)
    this.setPaths(tsCompilerOptions.paths!)
  }

  private set(path: string, value: string) {
    this.setFiles(files => {
      files[path] = value
      return files
    })
  }

  private has(path: string) {
    return path in this.files()
  }

  private getVirtualPath(url: string) {
    return (
      url
        .replace(`${this.config.cdn}/`, '')
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
            for (const key of Object.keys(this.files())) {
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
          this.alias(virtualPath, virtualPath)
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
        this.monaco.languages.typescript.typescriptDefaults.addExtraLib(
          value,
          `file:///.types/${key}`,
        )
      }
    })

    if (packageName) {
      this.cachedPackageNames.add(packageName)
      this.alias(packageName, virtualPath)
    }
  }

  private cachedPackageNames = new Set<string>()
  async importTypesFromPackageName(packageName: string) {
    if (this.cachedPackageNames.has(packageName)) return
    this.cachedPackageNames.add(packageName)

    const typeUrl = await fetch(`${this.config.cdn}/${packageName}`)
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

    this.alias(packageName, virtualPath)
  }
}
