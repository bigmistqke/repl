import { createScheduled, debounce } from '@solid-primitives/scheduled'
import {
  Accessor,
  Setter,
  batch,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  untrack,
} from 'solid-js'
import { when, whenever } from 'src/utils/conditionals'
import { javascript } from 'src/utils/object-url-literal'
import { isRelativePath, isUrl, relativeToAbsolutePath } from 'src/utils/path'
import { Runtime } from '../runtime'

/**
 * Represents a generic file within the virtual file system, providing methods to manipulate and access the file's source code.
 * This is an abstract class and should be extended to handle specific types of files.
 */
export abstract class VirtualFile {
  /**
   * Generates a new URL for an ES Module based on the current source code. This URL is not cached,
   * ensuring that each call provides a fresh module.
   * @returns A string representing the URL, or undefined if it cannot be generated.
   */
  abstract generate(): string | undefined
  /** The current URL of the loaded module, if available. */
  abstract url: string | undefined

  /** Source code of the file as a reactive state. */
  #source: Accessor<string>
  /** Setter for the source state. */
  #setSource: Setter<string>
  /** Derived state if the file is controlled. */
  #controlled: () => boolean

  /**
   * Constructs an instance of a Javascript file
   * @param repl - Reference to the ReplContext
   * @param path - Path in virtual file system
   */
  constructor(
    public runtime: Runtime,
    public path: string,
    /** If undefined controlled state will be derived from Runtime.config.controlled */
    controlled?: boolean,
  ) {
    ;[this.#source, this.#setSource] = createSignal<string>('')
    this.#controlled = () => (controlled !== undefined ? controlled : !!runtime.config.controlled)
  }

  /**
   * Serializes the file's current state to a JSON-compatible string.
   * @returns The current source code of the file.
   */
  toJSON() {
    return this.get()
  }

  /**
   * Sets the source code of the file.
   * @param value - New source code to set.
   */
  set(value: string) {
    this.runtime.config.onFileChange?.(this.path, value)
    if (!this.#controlled()) {
      this.#setSource(value)
    }
  }

  /**
   * Retrieves the current source code of the file.
   * @returns The current source code.
   */
  get() {
    return this.#controlled() ? this.runtime.config.files![this.path]! : this.#source()
  }

  moduleTransform(): string | null {
    const url = this.url
    if (!url) throw `Currently module-url of ${this.path} is undefined.`
    return url
  }
}

/**
 * Represents a JavaScript file within the system. Extends the generic File class.
 */
export class JsFile extends VirtualFile {
  /** An array of imported `VirtualFiles` found referred to in the source. */
  directDependencies: Accessor<VirtualFile[]>
  /** Internal setter for the imported `VirtualFiles`. */
  #setDirectDependencies: Setter<VirtualFile[]>
  /** Internal callback to get current module-url. */
  #getUrl: Accessor<string | undefined>
  /** Internal callback to get the esm output of the current source. */
  #esm: Accessor<string | undefined>

  constructor(
    public runtime: Runtime,
    public path: string,
  ) {
    super(runtime, path)
    ;[this.directDependencies, this.#setDirectDependencies] = createSignal<VirtualFile[]>([])

    let initialized = false
    const scheduled = createScheduled(fn => debounce(fn, 250))

    // Transpile source to javascript
    const [intermediary] = createResource(
      () => [this.get(), !initialized || scheduled()] as const,
      async ([source]) => {
        initialized = true
        try {
          if (Array.isArray(runtime.config.transform)) {
            return runtime.config.transform.reduce(
              (source, transform) => transform(source, path),
              source,
            )
          }
          return runtime.config.transform(this.get(), this.path)
        } catch (error) {
          console.error('error while transforming js', error)
        }
      },
    )

    // Transpile intermediary to esm-module:
    // - Transform aliased paths to module-urls
    // - Transform local dependencies to module-urls
    // - Transform package-names to cdn-url
    // NOTE:  possible optimisation would be to memo the holes and swap them out with .slice
    this.#esm = createMemo<string | undefined>(previous =>
      when(
        intermediary,
        value => {
          console.log('transpiling esm', path)
          const imports: VirtualFile[] = []
          const staleImports = new Set(untrack(this.directDependencies))
          try {
            return batch(() =>
              runtime.config.transformModulePaths(value, modulePath => {
                if (isUrl(modulePath)) return modulePath

                const alias = runtime.fileSystem.alias[modulePath]
                // If the module-path is either an aliased path or a relative path
                if (alias || isRelativePath(modulePath)) {
                  // We resolve the path to a File
                  const file = runtime.fileSystem.resolve(
                    // If path is aliased we resolve the aliased path
                    alias ||
                      // Else the path must be a relative path
                      // So we transform it to an absolute path
                      // and resolve this absolute path
                      relativeToAbsolutePath(path, modulePath),
                  )

                  if (!file) {
                    throw `Could not resolve relative module-path to its virtual file. Are you sure ${modulePath} exists?`
                  }

                  imports.push(file)
                  staleImports.delete(file)

                  return file.moduleTransform()
                }
                // If the module-path is
                //    - not an aliased path,
                //    - nor a relative dependency,
                //    - nor a url
                // It must be a package-name.
                else {
                  // We transform this package-name to a cdn-url.
                  if (runtime.config.importExternalTypes) {
                    runtime.typeRegistry.import.fromPackageName(modulePath)
                  }
                  return `${runtime.config.cdn}/${modulePath}`
                }
              }),
            )
          } catch (error) {
            console.warn('error', error)
            return previous
          } finally {
            this.#setDirectDependencies(imports)
          }
        },
        () => previous,
      ),
    )

    // Get latest module-url from esm-module
    this.#getUrl = createMemo(previous =>
      when(
        this.generate.bind(this),
        esm => esm,
        () => previous,
      ),
    )
  }

  /**
   * Resolves and returns all unique dependencies of the file, including both direct and indirect dependencies.
   * This method uses a depth-first search (DFS) approach to traverse and collect all imports.
   *
   * @returns A set of all unique import files.
   */
  resolveDependencies() {
    const set = new Set<VirtualFile>()
    const stack = [...this.directDependencies()] // Initialize the stack with direct imports

    while (stack.length > 0) {
      const file = stack.pop()
      if (file && !set.has(file)) {
        set.add(file)
        if (file instanceof JsFile) {
          for (const fileImport of file.directDependencies()) {
            if (!set.has(fileImport)) {
              stack.push(fileImport)
            }
          }
        }
      }
    }

    return Array.from(set)
  }

  generate() {
    return when(this.#esm.bind(this), esm =>
      URL.createObjectURL(
        new Blob([esm], {
          type: 'application/javascript',
        }),
      ),
    )
  }

  /**
   * Retrieves the URL of the currently active module.
   * @returns The URL as a string, or undefined if not available.
   */
  get url() {
    return this.#getUrl()
  }
}

/**
 * Represents a CSS file within the system. Extends the generic File class.
 */
export class CssFile extends VirtualFile {
  jsFile: JsFile

  /**
   * Constructs an instance of a CSS module associated with a specific CSS file.
   * @param file The CSS file managed by this module.
   */
  constructor(runtime: Runtime, path: string) {
    super(runtime, path)

    this.jsFile = runtime.fileSystem.create<JsFile>(path.replace('.css', '.js'))

    const scheduled = createScheduled(fn => debounce(fn, 250))

    createEffect(() => {
      if (!scheduled()) return
      this.jsFile.set(`
  import { dispose } from "@repl/std"
  (() => {
    let stylesheet = document.getElementById('bigmistqke-repl-${path}');
    stylesheet = document.createElement('style')
    stylesheet.setAttribute('id', 'bigmistqke-repl-${path}');
    document.head.appendChild(stylesheet)
    dispose('${path}', () => stylesheet.remove())
    const styles = document.createTextNode(\`${this.get()}\`)
    stylesheet.innerHTML = ''
    stylesheet.appendChild(styles)
  })()`)
    })

    createEffect(() => console.log('jsFile from css', this.jsFile.generate()))
  }

  generate() {
    return this.jsFile.generate()
  }

  /**
   * Retrieves the URL of the currently active CSS esm-module.
   * @returns The URL as a string, or undefined if not available.
   */
  get url() {
    return this.jsFile.url
  }
}

export class WasmFile extends VirtualFile {
  #getUrl: Accessor<string | undefined>
  generate: Accessor<string | undefined>
  /**
   * Constructs an instance of a WASM module associated with a specific WASM file.
   * @param path - The path to the WASM file within the virtual file system.
   */
  constructor(runtime: Runtime, path: string, controlled?: boolean) {
    super(runtime, path, controlled)

    const scheduled = createScheduled(fn => debounce(fn, 250))

    // Create a JavaScript module that instantiates the WASM module
    this.generate = () => {
      const wasmBinaryString = this.get()
      if (!wasmBinaryString) return undefined
      // Convert the binary string to a binary format
      const binaryBuffer = Uint8Array.from(atob(wasmBinaryString), c => c.charCodeAt(0))
      // Inline binary buffer into script
      return javascript`
const wasmCode = new Uint8Array([${binaryBuffer.toString()}]);
export default (imports) =>  WebAssembly.instantiate(wasmCode, imports).then(result => result.instance);
`
    }

    // Create a Blob URL for the JS wrapper
    // return URL.createObjectURL(new Blob([jsWrapper], { type: 'application/javascript' }))
    this.#getUrl = createMemo(previous => (!scheduled() ? previous : this.generate() || previous))
  }

  /**
   * Retrieves the URL of the currently active JavaScript wrapper module.
   * @returns The URL as a string, or undefined if not available.
   */
  get url() {
    return this.#getUrl()
  }
}

export class WasmTarget extends VirtualFile {
  private wasmFile: WasmFile
  constructor(runtime: Runtime, path: string, wasm: (source: string) => string | undefined) {
    super(runtime, path)
    this.wasmFile = new WasmFile(runtime, path.replace('.wat', '.wasm'))
    createEffect(
      whenever(
        () => wasm(this.get()),
        wasm => this.wasmFile.set(wasm),
      ),
    )
  }

  generate() {
    return this.wasmFile.generate()
  }

  get url() {
    return this.wasmFile.url // Use the URL from WasmFile
  }
}
