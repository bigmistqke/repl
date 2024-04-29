import * as Babel from '@babel/standalone'
import { Monaco } from '@monaco-editor/loader'
import { createScheduled, debounce, throttle } from '@solid-primitives/scheduled'
import {
  Accessor,
  Resource,
  Setter,
  batch,
  createMemo,
  createResource,
  createSignal,
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

export type Model = ReturnType<Monaco['editor']['createModel']>

export abstract class File {
  abstract model: Model
  abstract moduleUrl: Accessor<string | undefined>
  abstract toJSON(): string | undefined
  abstract set(value: string): void
  abstract get(): void
}

export class JsFile extends File {
  private source: Accessor<string | undefined>
  private setSource: Setter<string | undefined>
  model: Model
  /** url to esm-module of file */
  moduleUrl: Accessor<string | undefined>
  cssImports: Accessor<CssFile[]>
  private setCssImports: Setter<CssFile[]>

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

    const scheduled = createScheduled(fn => debounce(fn, 500))
    // Transpile source to javascript
    const [intermediary] = createResource(
      every(this.source, config.presets, config.plugins, scheduled),
      async ([source, presets, plugins]) => {
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
    // - Transform local dependencies to dependencies' File.url()
    // - Transform package-names to cdn-url
    // NOTE:  possible optimisation would be to memo the holes and swap them out with .slice
    const esm = createMemo<string | undefined>(previous =>
      when(intermediary)(value => {
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
                  const moduleUrl = resolvedFile?.moduleUrl()

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
          console.error('error', error)
          return previous
        }
      }),
    )

    // Get module-url from esm-module
    this.moduleUrl = createMemo(() =>
      when(esm)(esm => {
        return URL.createObjectURL(
          new Blob([esm], {
            type: 'application/javascript',
          }),
        )
      }),
    )

    // Subscribe to onDidChangeContent of this.model
    this.model.onDidChangeContent(() => {
      this.setSource(this.model.getValue())
    })
  }

  toJSON() {
    return this.source()
  }

  set(value: string) {
    this.model.setValue(value)
  }

  get() {
    this.source()
    return this.model.getValue()
  }
}

export class CssFile extends File {
  private source: Accessor<string | undefined>
  model: Model
  moduleUrl: Accessor<string | undefined>
  id: number | undefined

  constructor(fs: FileSystem, path: string) {
    super()
    const uri = fs.monaco.Uri.parse(`file:///${path.replace('./', '')}`)
    this.model = fs.monaco.editor.getModel(uri) || fs.monaco.editor.createModel('', 'css', uri)

    const [source, setSource] = createSignal<string | undefined>()
    this.source = source

    const scheduled = createScheduled(fn => throttle(fn, 1000))

    this.moduleUrl = createMemo(previous => {
      if (!scheduled) previous
      const source = `(() => {
        let stylesheet = document.getElementById('${path}');
        if (!stylesheet) {
          stylesheet = document.createElement('style')
          stylesheet.setAttribute('id', '${path}')
          document.head.appendChild(stylesheet)
        }
        const styles = document.createTextNode(\`${this.source()}\`)
        stylesheet.innerHTML = ''
        stylesheet.appendChild(styles)
      })()`

      const url = URL.createObjectURL(new Blob([source], { type: 'application/javascript' }))
      return url
    })
    // Subscribe to onDidChangeContent of this.model
    this.model.onDidChangeContent(() => {
      setSource(this.model.getValue())
    })
  }

  toJSON() {
    return this.source()
  }

  set(value: string) {
    this.model.setValue(value)
  }

  get() {
    this.source()
    return this.model.getValue()
  }
}
