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
import { javascript } from 'src/utils/module-literal'
import { isRelativePath, isUrl, relativeToAbsolutePath } from 'src/utils/path'
import type ts from 'typescript'
import { CssFile, JsFile } from './file'
import { Frame } from './frame-registry'
import { ReplContext } from './repl-context'

export type Model = ReturnType<Monaco['editor']['createModel']>

export abstract class Module {
  /**
   * `generate`: () => string | undefined
   * This function generates a new URL for an ES Module every time it is invoked, based on the current source code of the file.
   * It does not cache the URL. Use this if you need a new reference to the File's source, for example to re-execute the module's body.
   * @warning Cleanup the generated module-url with URL.revokeObjectURL() after usage to prevent memory leak.
   */
  abstract generate: Accessor<string | undefined>

  abstract url: string | undefined
}

/**
 * Represents a JavaScript executable within the run time, extending the generic Executable class.
 * This class handles the transpilation of a Javascript File of the virtual FileSystem.
 */
export class JsModule extends Module {
  generate: Accessor<string | undefined>
  private get: Accessor<string | undefined>
  /** Reactive state of CSS files imported into this JavaScript file. */
  cssImports: Accessor<CssFile[]>
  /** Setter for the cssImports state. */
  private setCssImports: Setter<CssFile[]>
  /**
   * Constructs an instance of a Javascript file
   * @param repl - Reference to the ReplContext
   * @param path - Path in virtual file system
   */
  constructor(repl: ReplContext, file: JsFile) {
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
        repl.libs.babelPresets,
        repl.libs.babelPlugins,
        // If no intermediary has been created before we do not throttle.
        () => !initialized || scheduled(),
      ),
      async ([source, presets, plugins]) => {
        initialized = true
        try {
          let value: string = source
          if (isTypescript) {
            const result = repl.libs.typescript.transpile(value, repl.config.typescript)
            if (result) value = result
          }
          if (repl.libs.babel) {
            value = repl.libs.babel.transform(value, { presets, plugins }).code!
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
            repl.mapModuleDeclarations(file.path, value, node => {
              const specifier = node.moduleSpecifier as ts.StringLiteral
              let modulePath = specifier.text

              if (isUrl(modulePath)) return

              const alias = repl.fileSystem.alias[modulePath]
              // If the module-path is either an aliased path or a relative path
              if (alias || isRelativePath(modulePath)) {
                // We resolve the path to a File
                const resolvedFile = repl.fileSystem.resolve(
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
                specifier.text = `${repl.config.cdn}/${modulePath}`
                repl.typeRegistry.importTypesFromPackageName(modulePath)
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
 * Represents a CSS file within the virtual file system, extending the generic File class.
 * Manages the editing and application of CSS within the IDE environment.
 */
export class CssModule extends Module {
  generate: Accessor<string | undefined>
  private get: Accessor<string | undefined>

  /**
   * Constructs an instance of a CSS file.
   * @param repl - Reference to the repl instance.
   * @param path - Path to the CSS file within the file system.
   */
  constructor(file: CssFile) {
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

  get url() {
    return this.get()
  }

  /**
   * Removes the style element associated with this instance from the specified document frame.
   *
   * @param frame - The window object of the frame from which the style is to be removed.
   *                Typically this is the window of an iframe or the main document window.
   */
  dispose(frame: Frame) {
    frame.contentWindow.document.getElementById(`bigmistqke-repl-${this.path}`)?.remove()
  }
}
