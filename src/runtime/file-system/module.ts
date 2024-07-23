import { Monaco } from '@monaco-editor/loader'
import { createScheduled, debounce } from '@solid-primitives/scheduled'
import {
  Accessor,
  Setter,
  batch,
  createMemo,
  createResource,
  createSignal,
  untrack,
} from 'solid-js'
import { every, when, whenever } from 'src/utils/conditionals'
import { javascript } from 'src/utils/object-url-literal'
import { isRelativePath, isUrl, relativeToAbsolutePath } from 'src/utils/path'
import type ts from 'typescript'
import { Frame } from '../frame-registry/frame'
import { Runtime } from '../runtime'
import { CssFile, JsFile } from './file'

export type Model = ReturnType<Monaco['editor']['createModel']>

/**
 * Abstract class representing a module that can generate and manage URLs for ES Modules based on source code.
 */
export abstract class Module {
  /**
   * Generates a new URL for an ES Module based on the current source code. This URL is not cached,
   * ensuring that each call provides a fresh module.
   * @returns A string representing the URL, or undefined if it cannot be generated.
   */
  abstract generate: Accessor<string | undefined>
  /**
   * The current URL of the loaded module, if available.
   */
  abstract url: string | undefined
}

/**
 * Represents a JavaScript module capable of transpilation and dynamic import handling within the system.
 */
export class JsModule extends Module {
  generate: Accessor<string | undefined>
  private get: Accessor<string | undefined>
  /** Reactive state of CSS files imported into this JavaScript file. */
  cssImports: Accessor<CssFile[]>
  /** Setter for the cssImports state. */
  private setCssImports: Setter<CssFile[]>
  /**
   * Creates a JavaScript module associated with a specific JavaScript file.
   * @param runtime - Reference to the ReplContext
   * @param path - Path in virtual file system
   */
  constructor(runtime: Runtime, file: JsFile) {
    super()

    const extension = file.path.split('/').pop()?.split('.')[1]
    const isTypescript = extension === 'ts' || extension === 'tsx'

    ;[this.cssImports, this.setCssImports] = createSignal<CssFile[]>([])

    let initialized = false
    const scheduled = createScheduled(fn => debounce(fn, 250))
    // Transpile source to javascript
    const [intermediary] = createResource(
      every(
        file.get.bind(file),
        runtime.libs.babelPresets,
        runtime.libs.babelPlugins,
        // If no intermediary has been created before we do not throttle.
        () => !initialized || scheduled(),
      ),
      async ([source, presets, plugins]) => {
        initialized = true
        try {
          let value: string = source
          if (isTypescript) {
            const result = runtime.libs.typescript.transpile(value, runtime.config.typescript)
            if (result) value = result
          }
          if (runtime.libs.babel) {
            value = runtime.libs.babel.transform(value, { presets, plugins }).code!
          }
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
      when(intermediary, value => {
        const staleImports = new Set(untrack(this.cssImports))

        try {
          return batch(() =>
            runtime.transpiler.transformModuleDeclarations(value, node => {
              const specifier = node.moduleSpecifier as ts.StringLiteral
              let modulePath = specifier.text

              if (isUrl(modulePath)) return

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
                    relativeToAbsolutePath(file.path, modulePath),
                )

                // If the resolved file is a js-file
                if (resolvedFile instanceof JsFile) {
                  // We get its module-url
                  if (resolvedFile.module.url) {
                    // If moduleUrl is defined
                    // We transform the relative depedency with the module-url
                    specifier.text = resolvedFile.module.url
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
                specifier.text = `${runtime.config.cdn}/${modulePath}`
                if (runtime.config.importExternalTypes) {
                  runtime.typeRegistry.import.fromPackageName(modulePath)
                }
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

    this.generate = whenever(esm, esm =>
      URL.createObjectURL(
        new Blob([esm], {
          type: 'application/javascript',
        }),
      ),
    )

    // Get module-url from esm-module
    this.get = createMemo(
      previous =>
        when(this.generate, moduleUrl => {
          if (previous) URL.revokeObjectURL(previous)
          return moduleUrl
        }) || previous,
    )
  }

  /**
   * Retrieves the URL of the currently active module.
   * @returns The URL as a string, or undefined if not available.
   */
  get url() {
    return this.get()
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
 * Represents a CSS module capable of handling style sheets within the `Runtime`. It extends the generic `Module` class
 * and provides mechanisms to apply styles dynamically to the document.
 */
export class CssModule extends Module {
  generate: Accessor<string | undefined>
  private get: Accessor<string | undefined>

  /**
   * Constructs an instance of a CSS module associated with a specific CSS file.
   * @param file The CSS file managed by this module.
   */
  constructor(private file: CssFile) {
    super()

    const scheduled = createScheduled(fn => debounce(fn, 250))

    this.generate = () => javascript`(() => {
        let stylesheet = document.getElementById('bigmistqke-repl-${file.path}');
        if (!stylesheet) {
          stylesheet = document.createElement('style')
          stylesheet.setAttribute('id', 'bigmistqke-repl-${file.path}');
          document.head.appendChild(stylesheet)
        }
        const styles = document.createTextNode(\`${file.get()}\`)
        stylesheet.innerHTML = ''
        stylesheet.appendChild(styles)
      })()`

    this.get = createMemo(previous => {
      if (!scheduled) previous
      return this.generate()
    })
  }

  /**
   * Retrieves the URL of the currently active CSS esm-module.
   * @returns The URL as a string, or undefined if not available.
   */
  get url() {
    return this.get()
  }

  /**
   * Removes the style element associated with this module from the specified `Frame`.
   * @param frame The `Frame` from which the style element is to be removed.
   */
  dispose(frame: Frame) {
    frame.contentWindow.document.getElementById(`bigmistqke-repl-${this.file.path}`)?.remove()
  }
}
