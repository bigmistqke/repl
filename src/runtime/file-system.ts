import { onCleanup } from 'solid-js'
import { SetStoreFunction, createStore } from 'solid-js/store'
import std from '../std/index?raw'
import { AbstractFile } from './file/virtual'
import { Runtime } from './runtime'

export interface FileSystemState {
  sources: Record<string, string>
  alias: Record<string, string>
}
export interface CompilationEvent {
  url: string
  path: string
  fileSystem: FileSystem
}
export type CompilationHandler = (event: CompilationEvent) => void

/**
 * Manages the virtual file system of code sources.
 * @class FileSystem
 */
export class FileSystem {
  /** Aliases for modules. */
  alias: Record<string, string>
  /** Store setter for aliases. */
  setAlias: SetStoreFunction<Record<string, string>>
  /** Stores file instances by path. */
  #files: Record<string, AbstractFile>
  /**
   * Store setter for files.
   * @private
   */
  #setFiles: SetStoreFunction<Record<string, AbstractFile>>

  /**
   * List of cleanup functions to be called on instance disposal.
   * @private
   */
  #cleanups: (() => void)[] = []

  constructor(public runtime: Runtime) {
    const [files, setFiles] = createStore<Record<string, AbstractFile>>({})
    this.#files = files
    this.#setFiles = setFiles
    ;[this.alias, this.setAlias] = createStore<Record<string, string>>({
      '@repl/std': '@repl/std.ts',
    })
    onCleanup(() => this.#cleanups.forEach(cleanup => cleanup()))
  }

  /** Initializes the file system based on provided initial files. */
  initialize(files: Record<string, string>) {
    const filesAndStd = {
      ...files,
      // Repl's standard library is passed to each repl-project.
      '@repl/std.ts': std,
    }
    for (const [path, source] of Object.entries(filesAndStd)) {
      this.create(path).set(source)
    }
  }

  /** Serializes the current state of the file system into JSON format. */
  toJSON(): FileSystemState {
    return {
      sources: Object.fromEntries(
        Object.entries(this.#files).map(([key, value]) => [key, value.toJSON()]),
      ),
      alias: this.alias,
    }
  }

  /** Adds a project by importing multiple files into the file system. */
  addProject(files: Record<string, string>) {
    Object.entries(files).forEach(([path, value]) => {
      this.create(path).set(value)
    })
  }

  /** Creates a new file in the file system at the specified path. */
  create<T extends AbstractFile>(path: string) {
    let extension: string | null = null

    for (const key in this.runtime.extensions) {
      if (
        path.endsWith(key) &&
        // Prefer the more specific extension: `.module.css` instead of `.css`
        key.length > (extension?.length || 0)
      ) {
        extension = key
      }
    }

    if (extension === null) {
      throw `extension type is not supported`
    }

    const file = new this.runtime.extensions[extension]!(this.runtime, path)
    this.#setFiles(path, file)
    return file as T
  }

  /** Checks if a file exists at the specified path. */
  has(path: string) {
    return path in this.#files
  }

  /** Retrieves a file from the file system by its path.  */
  get(path: string) {
    return this.#files[path]
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
      this.#files[path] ||
      this.#files[`${path}/index.ts`] ||
      this.#files[`${path}/index.tsx`] ||
      this.#files[`${path}/index.d.ts`] ||
      this.#files[`${path}/index.js`] ||
      this.#files[`${path}/index.jsx`] ||
      this.#files[`${path}.ts`] ||
      this.#files[`${path}.tsx`] ||
      this.#files[`${path}.d.ts`] ||
      this.#files[`${path}.js`] ||
      this.#files[`${path}.jsx`]
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
      Object.entries(this.#files).filter(([path]) => path.split('/')[0] !== 'node_modules'),
    )
  }

  remove(path: string) {
    this.#setFiles({ [path]: undefined })
  }
}
