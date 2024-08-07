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
import { getExtensionFromPath } from 'src/utils/get-extension-from-path'
import { javascript } from 'src/utils/object-url-literal'
import { isRelativePath, isUrl, relativeToAbsolutePath } from 'src/utils/path'
import { Frame } from '../frame-registry/frame'
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

  private controlled: () => boolean

  /**
   * Constructs an instance of a Javascript file
   * @param repl - Reference to the ReplContext
   * @param path - Path in virtual file system
   */
  constructor(
    public runtime: Runtime,
    public path: string,
    controlled?: boolean,
  ) {
    ;[this.#source, this.#setSource] = createSignal<string>('')
    this.controlled = () => (controlled !== undefined ? controlled : !!runtime.config.controlled)
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
    if (!this.controlled()) {
      this.#setSource(value)
    }
  }

  /**
   * Retrieves the current source code of the file.
   * @returns The current source code.
   */
  get() {
    return this.controlled() ? this.runtime.config.files![this.path]! : this.#source()
  }
}

/**
 * Represents a JavaScript file within the system. Extends the generic File class.
 */
export class JsFile extends VirtualFile {
  private getUrl: Accessor<string | undefined>
  private esm: Accessor<string | undefined>

  /** Reactive state of CSS files imported into this JavaScript file. */
  cssImports: Accessor<CssFile[]>
  /** Setter for the cssImports state. */
  private setCssImports: Setter<CssFile[]>
  /**
   * Creates a JavaScript module associated with a specific JavaScript file.
   * @param runtime - Reference to the ReplContext
   * @param path - Path in virtual file system
   */
  constructor(
    public runtime: Runtime,
    public path: string,
  ) {
    super(runtime, path)

    const extension = getExtensionFromPath(path)
    const isTypescript = extension === 'ts' || extension === 'tsx'

    ;[this.cssImports, this.setCssImports] = createSignal<CssFile[]>([])

    let initialized = false
    const scheduled = createScheduled(fn => debounce(fn, 250))

    // Transpile source to javascript
    const [intermediary] = createResource(
      () => [this.get(), !initialized || scheduled()],
      async () => ((initialized = true), runtime.config.transform(this.get(), this.path)),
    )

    // Transpile intermediary to esm-module:
    // - Transform aliased paths to module-urls
    // - Transform local dependencies to module-urls
    // - Transform package-names to cdn-url
    // NOTE:  possible optimisation would be to memo the holes and swap them out with .slice
    this.esm = createMemo<string | undefined>(previous =>
      when(intermediary, value => {
        const staleImports = new Set(untrack(this.cssImports))

        try {
          return batch(() =>
            runtime.config.transformModulePaths(value, modulePath => {
              if (isUrl(modulePath)) return modulePath

              const alias = runtime.fileSystem.alias[modulePath]
              // If the module-path is either an aliased path or a relative path
              if (alias || isRelativePath(modulePath)) {
                // We resolve the path to a File
                const resolvedFile = runtime.fileSystem.resolve(
                  // If path is aliased we resolve the aliased path
                  alias ||
                    // Else the path must be a relative path
                    // So we transform it to an absolute path
                    // and resolve this absolute path
                    relativeToAbsolutePath(path, modulePath),
                )

                // If the resolved file is a js-file
                if (resolvedFile instanceof JsFile) {
                  // We get its module-url
                  if (resolvedFile.url) {
                    // If moduleUrl is defined
                    // We transform the relative depedency with the module-url
                    return resolvedFile.url
                  } else {
                    // If moduleUrl is not defined, we throw.
                    // This will break the loop, so we can return the previous result.
                    throw `module ${modulePath} not defined`
                  }
                }
                // If the resolved file is a css-file
                else if (resolvedFile instanceof CssFile) {
                  // We add the resolved file to the css-imports of this js-file.
                  this.setCssImports(imports =>
                    imports.includes(resolvedFile) ? imports : [...imports, resolvedFile],
                  )
                  staleImports.delete(resolvedFile)
                  // Returning null will remove the node from the typescript-file
                  return null
                } else if (resolvedFile) {
                  if (!resolvedFile.url) throw `still loading dependency`
                  return resolvedFile.url
                }

                return modulePath
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
          this.setCssImports(cssImports =>
            cssImports.filter(cssImport => !staleImports.has(cssImport)),
          )
        }
      }),
    )

    // Get latest module-url from esm-module
    this.getUrl = createMemo(previous =>
      when(
        this.generate.bind(this),
        esm => esm,
        () => previous,
      ),
    )
  }

  generate() {
    return when(
      () => this.esm(),
      esm =>
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
    return this.getUrl()
  }

  /**
   * Executes the cleanup function attached to the `dispose` property of the window object in the provided frame.
   * This method is intended for use in environments where the cleanup logic is either explicitly mentioned in the code
   * or added through the code via a Babel transform: p.ex `solid-repl-plugin` of `@bigmistqke/repl/plugins`.
   * This plugin automatically assigns Solid.js's `render()` cleanup function to `window.dispose` so that the DOM can
   * be emptied in between runs.
   *
   * If you are using a different UI library or want to implement a custom cleanup mechanism, you will need to create or adapt
   * a Babel plugin to set the appropriate cleanup function to `window.dispose` according to your application's needs.
   *
   * @param frame - The frame containing the window object on which the cleanup function is called.
   *                This is typically an iframe or a similar isolated environment where the UI components are rendered.
   */
  dispose(frame: Frame) {
    // @ts-expect-error
    frame.contentWindow.dispose?.()
  }
}

/**
 * Represents a CSS file within the system. Extends the generic File class.
 */
export class CssFile extends VirtualFile {
  /** Module associated with the CSS file, handling CSS-specific interactions and styling applications. */
  private getUrl: Accessor<string | undefined>
  generate: Accessor<string | undefined>

  /**
   * Constructs an instance of a CSS module associated with a specific CSS file.
   * @param file The CSS file managed by this module.
   */
  constructor(runtime: Runtime, path: string) {
    super(runtime, path)

    const scheduled = createScheduled(fn => debounce(fn, 250))

    this.generate = () => javascript`
(() => {
  let stylesheet = document.getElementById('bigmistqke-repl-${path}');
  if (!stylesheet) {
    stylesheet = document.createElement('style')
    stylesheet.setAttribute('id', 'bigmistqke-repl-${path}');
    document.head.appendChild(stylesheet)
  }
  const styles = document.createTextNode(\`${this.get()}\`)
  stylesheet.innerHTML = ''
  stylesheet.appendChild(styles)
})()
`
    this.getUrl = createMemo(previous => {
      if (!scheduled()) previous
      return this.generate()
    })
  }

  /**
   * Retrieves the URL of the currently active CSS esm-module.
   * @returns The URL as a string, or undefined if not available.
   */
  get url() {
    return this.getUrl()
  }

  /**
   * Removes the style element associated with this module from the specified `Frame`.
   * @param frame The `Frame` from which the style element is to be removed.
   */
  dispose(frame: Frame) {
    frame.contentWindow.document.getElementById(`bigmistqke-repl-${this.path}`)?.remove()
  }
}

export class WasmFile extends VirtualFile {
  private getUrl: Accessor<string | undefined>
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
    this.getUrl = createMemo(previous => (!scheduled() ? previous : this.generate() || previous))
  }

  /**
   * Retrieves the URL of the currently active JavaScript wrapper module.
   * @returns The URL as a string, or undefined if not available.
   */
  get url() {
    return this.getUrl()
  }
}

export class CompiledFile extends VirtualFile {
  private wasmFile: WasmFile
  constructor(path: string, wasm: Accessor<string | undefined>) {
    super(path)
    this.wasmFile = new WasmFile(path.replace('.wat', '.wasm'))
    createEffect(whenever(wasm, wasm => this.wasmFile.set(wasm)))
  }

  generate() {
    return this.wasmFile.generate()
  }

  get url() {
    return this.wasmFile.url // Use the URL from WasmFile
  }
}
