import { createRoot, onCleanup } from 'solid-js'
import { SetStoreFunction, createStore } from 'solid-js/store'
import type ts from 'typescript'
import { isRelativePath, isUrl, relativeToAbsolutePath } from '../utils'
import { CssFile, File, JsFile } from './file'
import { PackageJsonParser } from './package-json'
import { ReplContext } from './repl-context'

export type FileSystemState = {
  sources: Record<string, string>
  alias: Record<string, string>
}

export type CompilationEvent = { url: string; path: string; fileSystem: FileSystem }
export type CompilationHandler = (event: CompilationEvent) => void

/**
 * Manages the virtual file system within a Monaco Editor-based TypeScript IDE.
 * This class handles file operations, module imports, and integration of TypeScript types,
 * providing a robust environment for coding directly in the browser.
 *
 * @class FileSystem
 */
export class FileSystem {
  /**
   * Stores aliases for modules.
   */
  alias: Record<string, string>
  /**
   * Utility to parse package.json files for module management.
   */
  packageJsonParser = new PackageJsonParser()
  /**
   * Store setter for aliases.
   * @private
   */
  private setAlias: SetStoreFunction<Record<string, string>>
  /**
   * Stores file instances by path.
   * @private
   */
  private files: Record<string, File>
  /**
   * Store setter for files.
   * @private
   */
  private setFiles: SetStoreFunction<Record<string, File>>
  /**
   * List of cleanup functions to be called on instance disposal.
   * @private
   */
  private cleanups: (() => void)[] = []

  /**
   * Constructs an instance of the FileSystem, setting up initial properties and configuration.
   *
   * @param repl - The `ReplContext` instance.
   */
  constructor(public repl: ReplContext) {
    ;[this.alias, this.setAlias] = createStore<Record<string, string>>({})
    ;[this.files, this.setFiles] = createStore<Record<string, File>>()

    onCleanup(() => this.cleanups.forEach(cleanup => cleanup()))
  }

  /**
   * Initializes the file system based on provided initial configuration, setting up files and types.
   */
  initialize(initialState: Partial<FileSystemState>) {
    if (initialState.sources) {
      Object.entries(initialState.sources).map(([path, source]) => this.create(path).set(source))
    }
    if (initialState.alias) {
      this.setAlias(initialState.alias)
    }
  }

  /**
   * Serializes the current state of the file system into JSON format.
   *
   * @returns JSON representation of the file system state.
   */
  toJSON(): FileSystemState {
    return {
      sources: Object.fromEntries(
        Object.entries(this.files).map(([key, value]) => [key, value.toJSON()]),
      ),
      alias: this.alias,
    }
  }

  /**
   * Creates a new file in the file system at the specified path.
   *
   * @param path - The path to create the file at.
   * @returns The newly created file instance.
   */
  create(path: string) {
    const file = path.endsWith('.css') ? new CssFile(this.repl, path) : new JsFile(this.repl, path)
    this.setFiles(path, file)
    return file
  }

  /**
   * Checks if a file exists at the specified path.
   *
   * @param path - The path to check for a file.
   * @returns True if the file exists, false otherwise.
   */
  has(path: string) {
    return path in this.files
  }

  /**
   * Retrieves a file from the file system by its path.
   *
   * @param path - The path to retrieve the file from.
   * @returns The file instance if found, undefined otherwise.
   */
  get(path: string) {
    return this.files[path]
  }

  /**
   * Adds a project by importing multiple files into the file system.
   *
   * @param files - A record of file paths and their content to add to the file system.
   */
  addProject(files: Record<string, string>) {
    Object.entries(files).forEach(([path, value]) => {
      this.create(path).set(value)
    })
  }

  /**
   * Imports a package from a specified URL by parsing its package.json and loading its main script and types.
   * This method handles resolving paths, fetching content, and transforming module declarations to maintain compatibility.
   *
   * @param url - The URL to the package.json of the package to import.
   * @returns A promise that resolves when the package has been fully imported.
   * @async
   */
  async importFromPackageJson(url: string) {
    const getVirtualPath = (url: string) => (isUrl(url) ? new URL(url).pathname : url)

    const { typesUrl, scriptUrl, packageName } = await this.packageJsonParser.parse(url)

    const project: Record<string, string> = {}
    const resolvePath = async (url: string) => {
      const virtualPath = getVirtualPath(url)

      const code = await fetch(url).then(response => {
        if (response.status !== 200) {
          throw new Error(`Error while loading ${url}: ${response.statusText}`)
        }
        return response.text()
      })

      const promises: Promise<void>[] = []

      const transformedCode = this.repl.mapModuleDeclarations(virtualPath, code, node => {
        const specifier = node.moduleSpecifier as ts.StringLiteral
        const path = specifier.text
        if (isRelativePath(path)) {
          promises.push(resolvePath(relativeToAbsolutePath(url, path)))
        }
      })

      if (!transformedCode) {
        throw new Error(`Transform returned undefined for ${virtualPath}`)
      }

      await Promise.all(promises)

      project[virtualPath] = transformedCode
    }
    await resolvePath(scriptUrl)

    // TODO:  It feels a bit dirty having to wrap it all in a root
    //        Maybe there is a more resource-y way of doing this.
    createRoot(dispose => {
      Object.entries(project).forEach(([path, value]) => {
        this.create(`node_modules${path}`).set(value)
      })
      this.cleanups.push(dispose)
    })

    if (typesUrl) {
      await this.repl.typeRegistry.importTypesFromUrl(typesUrl, packageName)
    }

    this.setAlias(packageName, `node_modules${getVirtualPath(scriptUrl)}`)
  }

  /**
   * Resolves a file path according to TypeScript resolution rules, including handling of various module formats.
   * This method searches for file instances across supported extensions and directories based on TypeScript's module resolution logic.
   *
   * @param path - The path to resolve, which might not include a file extension.
   * @returns The resolved file if found, otherwise undefined.
   */
  resolve(path: string) {
    return (
      this.files[path] ||
      this.files[`${path}/index.ts`] ||
      this.files[`${path}/index.tsx`] ||
      this.files[`${path}/index.d.ts`] ||
      this.files[`${path}/index.js`] ||
      this.files[`${path}/index.jsx`] ||
      this.files[`${path}.ts`] ||
      this.files[`${path}.tsx`] ||
      this.files[`${path}.d.ts`] ||
      this.files[`${path}.js`] ||
      this.files[`${path}.jsx`]
    )
  }

  /**
   * Retrieves all files from the file system, excluding those within 'node_modules' directory,
   * effectively filtering out externally added packages from the result.
   *
   * @returns An object mapping paths to file instances for all user-created or modified files.
   */
  all() {
    return Object.fromEntries(
      Object.entries(this.files).filter(([path]) => path.split('/')[0] !== 'node_modules'),
    )
  }
}
