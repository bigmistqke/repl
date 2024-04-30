import * as Babel from '@babel/standalone'
import { Monaco } from '@monaco-editor/loader'
import { createScheduled, debounce } from '@solid-primitives/scheduled'
import {
  Accessor,
  Resource,
  Setter,
  batch,
  createMemo,
  createResource,
  createSignal,
  untrack,
} from 'solid-js'
import ts from 'typescript'
import {
  every,
  isRelativePath,
  isUrl,
  mapModuleDeclarations,
  relativeToAbsolutePath,
  when,
} from '..'
import { FileSystem } from './file-system'
import { Frame } from './frame-registry'

export type Model = ReturnType<Monaco['editor']['createModel']>

export abstract class File {
  /** Model associated with the Monaco editor for this CSS file. */
  abstract model: Model
  /**
   * `generateModuleUrl`: () => string | undefined
   * This function generates a new URL for an ES Module every time it is invoked, based on the current source code of the file.
   * It does not cache the URL. Use this if you need a new reference to the File's source, for example to re-execute the module's body.
   * @warning Cleanup the generated module-url with URL.revokeObjectURL() after usage to prevent memory leak.
   */
  abstract generateModuleUrl: Accessor<string | undefined>
  /**
   * `cachedModuleUrl`: Accessor<string | undefined>
   * This property holds a memoized URL for an ES Module, created from the file's source code.
   * The URL is cached to optimize repeated accesses by avoiding redundant computations.
   * Use this when you need consistent access to a module, for example when linking modules.
   */
  abstract cachedModuleUrl: Accessor<string | undefined>
  abstract toJSON(): string | undefined
  abstract set(value: string): void
  abstract get(): void
}

/**
 * Represents a JavaScript file within the virtual file system, extending the generic File class.
 * This class handles the transpilation of JavaScript or TypeScript into ES modules,
 * manages CSS imports, and maintains the source code state.
 */

export class JsFile extends File {
  model: Model
  generateModuleUrl: Accessor<string | undefined>
  cachedModuleUrl: Accessor<string | undefined>
  /** Source code of the file as a reactive state. */
  private source: Accessor<string | undefined>
  /** Setter for the source state. */
  private setSource: Setter<string | undefined>
  /** Reactive state of CSS files imported into this JavaScript file. */
  cssImports: Accessor<CssFile[]>
  /** Setter for the cssImports state. */
  private setCssImports: Setter<CssFile[]>

  /**
   * Constructs an instance of a JavaScript file.
   * @param {FileSystem} fs - Reference to the file system managing this file.
   * @param {string} path - Path to the file within the file system.
   * @param {Object} config - Configuration for transpilation, including Babel presets and plugins.
   */
  constructor(
    private fs: FileSystem,
    path: string,
    config: {
      presets: Resource<any[]>
      plugins: Resource<babel.PluginItem[]>
    },
  ) {
    super()

    const extension = path.split('/').pop()?.split('.')[1]
    const isTypescript = extension === 'ts' || extension === 'tsx'
    const uri = fs.monaco.Uri.parse(`file:///${path.replace('./', '')}`)
    this.model =
      fs.monaco.editor.getModel(uri) || fs.monaco.editor.createModel('', 'typescript', uri)
    ;[this.source, this.setSource] = createSignal<string | undefined>()
    ;[this.cssImports, this.setCssImports] = createSignal<CssFile[]>([])

    let initialized = false
    const scheduled = createScheduled(fn => debounce(fn, 250))
    // Transpile source to javascript
    const [intermediary] = createResource(
      every(
        this.source,
        config.presets,
        config.plugins,
        // If no intermediary has been created before we do not throttle.
        () => !initialized || scheduled(),
      ),
      async ([source, presets, plugins]) => {
        initialized = true
        try {
          let value: string = source
          if (isTypescript) {
            const options = fs.monaco.languages.typescript.typescriptDefaults.getCompilerOptions()
            const result = ts.transpile(value, options)
            if (result) value = result
          }
          if (presets.length !== 0) value = Babel.transform(value, { presets, plugins }).code!
          return value
        } catch (err) {
          return source
        }
      },
    )

    // Transpile intermediary to esm-module:
    // - Transform aliased paths to module-urls
    // - Transform local dependencies to module-urls
    // - Transform package-names to cdn-url
    // NOTE:  possible optimisation would be to memo the holes and swap them out with .slice
    const esm = createMemo<string | undefined>(previous =>
      when(intermediary)(value => {
        const staleImports = new Set(untrack(this.cssImports))

        try {
          return batch(() =>
            mapModuleDeclarations(path, value, node => {
              const specifier = node.moduleSpecifier as ts.StringLiteral
              let modulePath = specifier.text

              if (isUrl(modulePath)) return

              const alias = this.fs.alias[modulePath]
              // If the module-path is either an aliased path or a relative path
              if (alias || isRelativePath(modulePath)) {
                // We resolve the path to a File
                const resolvedFile = fs.resolve(
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
                  const moduleUrl = resolvedFile?.cachedModuleUrl()

                  if (moduleUrl) {
                    // If moduleUrl is defined
                    // We transform the relative depedency with the module-url
                    specifier.text = moduleUrl
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
                  // Returning false will remove the node from the typescript-file
                  return false
                }
              }
              // If the module-path is
              //    - not an aliased path,
              //    - nor a relative dependency,
              //    - nor a url
              // It must be a package-name.
              else if (!isUrl(modulePath)) {
                // We transform this package-name to a cdn-url.
                specifier.text = `${this.fs.config.cdn}/${modulePath}`
                this.fs.typeRegistry.importTypesFromPackageName(modulePath)
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

    this.generateModuleUrl = () =>
      when(esm)(esm => {
        return URL.createObjectURL(
          new Blob([esm], {
            type: 'application/javascript',
          }),
        )
      })

    // Get module-url from esm-module
    this.cachedModuleUrl = createMemo(
      previous =>
        when(this.generateModuleUrl)(moduleUrl => {
          if (previous) URL.revokeObjectURL(previous)
          return moduleUrl
        }) || previous,
    )

    // Subscribe to onDidChangeContent of this.model
    this.model.onDidChangeContent(() => {
      this.setSource(this.model.getValue())
    })
  }

  /**
   * Serializes the file's current state to a JSON-compatible string.
   * @returns {string | undefined} The current source code of the file.
   */
  toJSON() {
    return this.source()
  }

  /**
   * Sets the source code of the file.
   * @param {string} value - New source code to set.
   */
  set(value: string) {
    this.model.setValue(value)
  }

  /**
   * Retrieves the current source code of the file.
   * @returns {string} The current source code.
   */
  get() {
    this.source()
    return this.model.getValue()
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
   * @param {Frame} frame - The frame containing the window object on which the cleanup function is called.
   *                        This is typically an iframe or a similar isolated environment where the UI components are rendered.
   */
  dispose(frame: Frame) {
    // @ts-expect-error
    frame.window.dispose?.()
  }
}

/**
 * Represents a CSS file within the virtual file system, extending the generic File class.
 * Manages the editing and application of CSS within the IDE environment.
 */
export class CssFile extends File {
  model: Model
  generateModuleUrl: Accessor<string | undefined>
  cachedModuleUrl: Accessor<string | undefined>

  /** Source code of the CSS file as a reactive state. */
  private source: Accessor<string | undefined>

  /**
   * Constructs an instance of a CSS file.
   * @param {FileSystem} fs - Reference to the file system managing this file.
   * @param {string} path - Path to the CSS file within the file system.
   */
  constructor(
    fs: FileSystem,
    public path: string,
  ) {
    super()
    const uri = fs.monaco.Uri.parse(`file:///${path.replace('./', '')}`)
    this.model = fs.monaco.editor.getModel(uri) || fs.monaco.editor.createModel('', 'css', uri)

    const [source, setSource] = createSignal<string | undefined>()
    this.source = source

    const scheduled = createScheduled(fn => debounce(fn, 250))

    this.generateModuleUrl = () => {
      const source = `(() => {
        let stylesheet = document.getElementById('bigmistqke-repl-${this.path}');
        if (!stylesheet) {
          stylesheet = document.createElement('style')
          stylesheet.setAttribute('id', 'bigmistqke-repl-${this.path}');
          document.head.appendChild(stylesheet)
        }
        const styles = document.createTextNode(\`${this.source()}\`)
        stylesheet.innerHTML = ''
        stylesheet.appendChild(styles)
      })()`
      return URL.createObjectURL(new Blob([source], { type: 'application/javascript' }))
    }

    this.cachedModuleUrl = createMemo(previous => {
      if (!scheduled) previous
      if (previous) URL.revokeObjectURL(previous)
      return this.generateModuleUrl()
    })
    // Subscribe to onDidChangeContent of this.model
    this.model.onDidChangeContent(() => {
      setSource(this.model.getValue())
    })
  }

  /**
   * Serializes the CSS file's current state to a JSON-compatible string.
   * @returns {string | undefined} The current source code of the CSS file.
   */
  toJSON() {
    return this.source()
  }

  /**
   * Sets the source code of the CSS file.
   * @param {string} value - New source code to set.
   */
  set(value: string) {
    this.model.setValue(value)
  }

  /**
   * Retrieves the current source code of the CSS file.
   * @returns {string} The current source code.
   */
  get() {
    this.source()
    return this.model.getValue()
  }

  /**
   * Removes the style element associated with this instance from the specified document frame.
   *
   * @param {Window} frame - The window object of the frame from which the style is to be removed.
   *                         Typically this is the window of an iframe or the main document window.
   */
  dispose(frame: Frame) {
    frame.window.document.getElementById(`bigmistqke-repl-${this.path}`)?.remove()
  }
}
