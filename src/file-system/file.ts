import * as Babel from '@babel/standalone'
import { when } from '@bigmistqke/when'
import { Monaco } from '@monaco-editor/loader'
import {
  Accessor,
  Resource,
  Setter,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
} from 'solid-js'
import {
  every,
  mapModuleDeclarations,
  pathIsRelativePath,
  pathIsUrl,
  relativeToAbsolutePath,
} from 'src/utils'
import ts from 'typescript'
import { CompilationEvent, CompilationHandler, FileSystem } from '.'

type Model = ReturnType<Monaco['editor']['createModel']>
export class File {
  private source: Accessor<string | undefined>
  private setSource: Setter<string | undefined>
  model: Model
  moduleUrl: Accessor<string | undefined>
  constructor(
    private fileSystem: FileSystem,
    path: string,
    config: {
      presets: Resource<any[]>
      plugins: Resource<babel.PluginItem[]>
    },
  ) {
    const extension = path.split('/').pop()?.split('.')[1]
    const isTypescript = extension === 'ts' || extension === 'tsx'
    const uri = fileSystem.monaco.Uri.parse(`file:///${path.replace('./', '')}`)
    this.model = fileSystem.monaco.editor.createModel('', 'typescript', uri)

    const [source, setSource] = createSignal<string | undefined>()
    this.source = source
    this.setSource = setSource

    // Transpile source to javascript
    const [intermediary] = createResource(
      every(source, config.presets, config.plugins),
      async ([content, presets, plugins]) => {
        try {
          let value: string = content
          if (isTypescript) {
            value = await fileSystem
              .typescriptWorker(this.model.uri)
              .then(result => result.getEmitOutput(`file://${this.model.uri.path}`))
              .then(result => result.outputFiles[0]?.text || value)
          }
          if (presets.length !== 0) value = Babel.transform(value, { presets, plugins }).code!
          return value
        } catch (err) {
          return content
        }
      },
    )

    // Transpile intermediary to module-source
    // - Transform local dependencies to dependencies' File.url()
    // - Transform package-names to cdn-url
    const module = () =>
      when(intermediary)(value =>
        mapModuleDeclarations(path, value, node => {
          const specifier = node.moduleSpecifier as ts.StringLiteral
          const modulePath = specifier.text
          if (pathIsUrl(modulePath)) return
          // If the module is a local dependency
          if (pathIsRelativePath(modulePath)) {
            const absolutePath = relativeToAbsolutePath(path, modulePath)
            // We get the module-url from the module's File
            // Which automatically subscribes
            const url = fileSystem.get(absolutePath)?.moduleUrl()
            if (url) {
              specifier.text = url
            } else {
              console.info(`module ${modulePath} not defined`)
            }
          }
          // If the module is not a local dependency
          else {
            // We transform the package-name to a cdn-url.
            specifier.text = `${this.fileSystem.config.cdn}/${modulePath}`
            this.fileSystem.typeRegistry.importTypesFromPackageName(modulePath)
          }
        }),
      )

    // Get blob-url from module
    const moduleUrl = createMemo(() =>
      when(module)(modified => {
        return URL.createObjectURL(
          new Blob([modified], {
            type: 'application/javascript',
          }),
        )
      }),
    )

    // Call onCompilationHandlers
    createEffect(() =>
      when(moduleUrl)(url => this.callOnCompilationHandlers({ url, fileSystem, path })),
    )

    // Subscribe to onDidChangeContent of this.model
    this.model.onDidChangeContent(() => setSource(this.model.getValue()))
    this.moduleUrl = moduleUrl
  }

  toJSON() {
    return this.source()
  }

  set(value: string) {
    this.model.setValue(value)
  }

  private onCompilationHandlers: CompilationHandler[] = []
  private callOnCompilationHandlers(event: CompilationEvent) {
    this.onCompilationHandlers.forEach(handler => handler(event))
  }
  onCompilation(callback: CompilationHandler) {
    this.onCompilationHandlers.push(callback)
    onCleanup(() => {
      const index = this.onCompilationHandlers.findIndex(handler => handler !== callback)
      if (index !== -1) this.onCompilationHandlers.slice(index, 1)
    })
  }
}
