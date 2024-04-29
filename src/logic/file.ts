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
  mapModuleDeclarations,
  pathIsRelativePath,
  pathIsUrl,
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

    // Transpile intermediary to module:
    // - Transform local dependencies to dependencies' File.url()
    // - Transform package-names to cdn-url
    // NOTE:  possible optimisation would be to memo the holes and swap them out with .slice
    const module = createMemo<string | undefined>(previous =>
      when(intermediary)(value => {
        try {
          return batch(() =>
            mapModuleDeclarations(path, value, node => {
              /* this.setCssImports([]) */
              const specifier = node.moduleSpecifier as ts.StringLiteral
              let modulePath = specifier.text

              if (pathIsUrl(modulePath)) return

              const alias = this.fs.localPackages[modulePath]

              if (alias) {
                const file = fs.resolve(alias)
                if (file instanceof JsFile) {
                  const moduleUrl = file?.moduleUrl()

                  if (moduleUrl) {
                    // If moduleUrl is defined
                    // We transform the relative depedency with the module-url
                    specifier.text = moduleUrl
                  } else {
                    // If moduleUrl is not undefined
                    // We throw and return previous code
                    throw `module ${modulePath} not defined`
                  }
                }
              }
              // If the module is a local dependency
              else if (pathIsRelativePath(modulePath)) {
                const absolutePath = relativeToAbsolutePath(path, modulePath)
                // We get the module-url from the module's File
                // Which automatically subscribes
                const file = fs.resolve(absolutePath)
                if (file instanceof JsFile) {
                  const moduleUrl = file?.moduleUrl()

                  if (moduleUrl) {
                    // If moduleUrl is defined
                    // We transform the relative depedency with the module-url
                    specifier.text = moduleUrl
                  } else {
                    // If moduleUrl is not undefined
                    // We throw and return previous code
                    throw `module ${modulePath} not defined`
                  }
                } else if (file instanceof CssFile) {
                  this.setCssImports(imports =>
                    imports.includes(file) ? imports : [...imports, file],
                  )
                  throw 'remove css-import'
                }
              }
              // If the module is not a local dependency
              else {
                // We transform the package-name to a cdn-url.
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

    // Get blob-url from module
    const moduleUrl = createMemo(() =>
      when(module)(value => {
        return URL.createObjectURL(
          new Blob([value], {
            type: 'application/javascript',
          }),
        )
      }),
    )

    // Subscribe to onDidChangeContent of this.model
    this.model.onDidChangeContent(() => {
      this.setSource(this.model.getValue())
    })
    this.moduleUrl = moduleUrl
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
