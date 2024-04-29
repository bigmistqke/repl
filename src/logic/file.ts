import * as Babel from '@babel/standalone'
import { Monaco } from '@monaco-editor/loader'
import { Accessor, Resource, createMemo, createResource, createSignal } from 'solid-js'
import {
  createLog,
  every,
  mapModuleDeclarations,
  pathIsRelativePath,
  pathIsUrl,
  relativeToAbsolutePath,
  when,
} from 'src/utils'
import ts from 'typescript'
import { FileSystem } from './file-system'

const log = createLog('file', false)

type Model = ReturnType<Monaco['editor']['createModel']>

export class File {
  private source: Accessor<string | undefined>
  model: Model
  moduleUrl: Accessor<string | undefined>
  constructor(
    private fs: FileSystem,
    path: string,
    config: {
      presets: Resource<any[]>
      plugins: Resource<babel.PluginItem[]>
    },
  ) {
    const extension = path.split('/').pop()?.split('.')[1]
    const isTypescript = extension === 'ts' || extension === 'tsx'
    const uri = fs.monaco.Uri.parse(`file:///${path.replace('./', '')}`)
    this.model =
      fs.monaco.editor.getModel(uri) || fs.monaco.editor.createModel('', 'typescript', uri)

    const [source, setSource] = createSignal<string | undefined>()
    this.source = source

    // Transpile source to javascript
    const [intermediary] = createResource(
      every(source, config.presets, config.plugins),
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
        log('intermediary: ', value)
        try {
          return mapModuleDeclarations(path, value, node => {
            const specifier = node.moduleSpecifier as ts.StringLiteral
            let modulePath = specifier.text

            if (pathIsUrl(modulePath)) return

            const alias = this.fs.localPackages[modulePath]

            if (alias) {
              const file = fs.resolve(alias)
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
            // If the module is a local dependency
            else if (pathIsRelativePath(modulePath)) {
              const absolutePath = relativeToAbsolutePath(path, modulePath)
              // We get the module-url from the module's File
              // Which automatically subscribes
              const file = fs.resolve(absolutePath)
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
            // If the module is not a local dependency
            else {
              // We transform the package-name to a cdn-url.
              specifier.text = `${this.fs.config.cdn}/${modulePath}`
              this.fs.typeRegistry.importTypesFromPackageName(modulePath)
            }
          })
        } catch (error) {
          console.error('error', error)
          return previous
        }
      }),
    )

    // Get blob-url from module
    const moduleUrl = createMemo(() =>
      when(module)(value => {
        log('modified: ', value)
        return URL.createObjectURL(
          new Blob([value], {
            type: 'application/javascript',
          }),
        )
      }),
    )

    // Subscribe to onDidChangeContent of this.model
    this.model.onDidChangeContent(() => {
      log('changed', this.model.getValue())
      setSource(this.model.getValue())
    })
    this.moduleUrl = moduleUrl
  }

  toJSON() {
    return this.source()
  }

  set(value: string) {
    log('set', value)
    this.model.setValue(value)
  }

  get() {
    this.source()
    return this.model.getValue()
  }
}
