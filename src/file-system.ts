import * as Babel from '@babel/standalone'
import { Monaco } from '@monaco-editor/loader'
import {
  Accessor,
  Resource,
  Setter,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  mergeProps,
  onCleanup,
} from 'solid-js'
import { SetStoreFunction, createStore } from 'solid-js/store'
import ts from 'typescript'
import { ReplConfig } from './repl'
import { TypeRegistry, TypeRegistryState } from './type-registry'
import {
  Mandatory,
  every,
  mapModuleDeclarations,
  pathIsRelativePath,
  pathIsUrl,
  relativeToAbsolutePath,
  when,
} from './utils'

type TypescriptWorker = Awaited<
  ReturnType<Monaco['languages']['typescript']['getTypeScriptWorker']>
>
type Model = ReturnType<Monaco['editor']['createModel']>
type FileSystemConfig = Omit<ReplConfig, 'typescript'>
export type FileSystemState = {
  files: Record<string, string>
  types: TypeRegistryState
}

export type CompilationEvent = { url: string; path: string; fileSystem: FileSystem }
export type CompilationHandler = (event: CompilationEvent) => void
export class FileSystem {
  typeRegistry: TypeRegistry
  private files: Record<string, File>
  private setFiles: SetStoreFunction<Record<string, File>>
  private presets: Resource<any[]>
  private plugins: Resource<babel.PluginItem[]>
  frame: Accessor<Window | undefined>
  setFrame: Setter<Window | undefined>
  config: Mandatory<FileSystemConfig, 'cdn'>
  constructor(
    public monaco: Monaco,
    public typescriptWorker: TypescriptWorker,
    config: FileSystemConfig,
  ) {
    this.config = mergeProps({ cdn: 'https://esm.sh' }, config)
    this.typeRegistry = new TypeRegistry(monaco, { initialState: config.initialState?.types })

    const [files, setFiles] = createStore<Record<string, File>>()
    this.files = files
    this.setFiles = setFiles

    const [frame, setFrame] = createSignal<Window | undefined>()
    this.frame = frame
    this.setFrame = setFrame

    const [presets] = createResource(
      () => this.config?.babel?.presets || [],
      presets =>
        Promise.all(
          presets.map(async preset => (await import(`${this.config.cdn}/${preset}`)).default),
        ),
    )
    this.presets = presets
    const [plugins] = createResource(
      () => this.config?.babel?.plugins || [],
      plugins =>
        Promise.all(
          plugins.map(async plugin => {
            if (typeof plugin === 'string') {
              return (await import(`${this.config.cdn}/${plugin}`)).default
            }
            return plugin
          }),
        ),
    )
    this.plugins = plugins

    createEffect(() => {
      config.packages?.forEach(packageName => {
        this.typeRegistry.importTypesFromPackageName(packageName)
      })
    })
  }

  static async create(monaco: Monaco, config: FileSystemConfig) {
    const typescriptWorker = await monaco.languages.typescript.getTypeScriptWorker()
    return new FileSystem(monaco, typescriptWorker, config)
  }

  toJSON() {
    const files = Object.fromEntries(
      Object.entries(this.files).map(([key, value]) => [key, value.toJSON()]),
    )
    return {
      types: this.typeRegistry.toJSON(),
      files,
    }
  }

  download(name = 'repl.config.json') {
    const data = this.toJSON()

    const blob = new Blob([JSON.stringify(data)], { type: 'text/json' })
    const link = document.createElement('a')

    link.download = 'repl.config.json'
    link.href = window.URL.createObjectURL(blob)
    link.dataset.downloadurl = ['text/json', link.download, link.href].join(':')
    const evt = new MouseEvent('click', {
      view: window,
      bubbles: true,
      cancelable: true,
    })

    link.dispatchEvent(evt)
    link.remove()
  }

  create(path: string) {
    const file = new File(this, path, { presets: this.presets, plugins: this.plugins })
    file.onCompilation(this.callOnCompilationHandlers.bind(this))
    this.setFiles(path, file)
    return file
  }

  has(path: string) {
    return path in this.files
  }

  get(path: string) {
    return this.files[path]
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

class File {
  private content: Accessor<string | undefined>
  private setContent: Setter<string | undefined>
  model: Model
  url: Accessor<string | undefined>
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

    const [content, setContent] = createSignal<string | undefined>()
    this.content = content
    this.setContent = setContent

    const [transpiled] = createResource(
      every(content, config.presets, config.plugins),
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
    const modified = () =>
      when(transpiled)(value =>
        mapModuleDeclarations(path, value, node => {
          const specifier = node.moduleSpecifier as ts.StringLiteral
          const modulePath = specifier.text
          if (pathIsUrl(modulePath)) return
          if (pathIsRelativePath(modulePath)) {
            const absolutePath = relativeToAbsolutePath(path, modulePath)
            const importUrl = fileSystem.get(absolutePath)?.url()
            if (importUrl) {
              specifier.text = importUrl
            } else {
              console.error(`module ${modulePath} not defined`)
            }
          } else {
            specifier.text = `${this.fileSystem.config.cdn}/${modulePath}`
            this.fileSystem.typeRegistry.importTypesFromPackageName(modulePath)
          }
        }),
      )

    const url = createMemo(() =>
      when(modified)(modified => {
        return URL.createObjectURL(
          new Blob([modified], {
            type: 'application/javascript',
          }),
        )
      }),
    )

    createEffect(() => when(url)(url => this.callOnCompilationHandlers({ url, fileSystem, path })))

    this.model.onDidChangeContent(() => setContent(this.model.getValue()))
    this.url = url
  }

  toJSON() {
    return this.content()
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
