import * as Babel from '@babel/standalone'
import { Monaco } from '@monaco-editor/loader'
import { Accessor, Resource, createMemo, createResource, createSignal, mergeProps } from 'solid-js'
import { SetStoreFunction, createStore } from 'solid-js/store'
import ts from 'typescript'
import { TypeRegistry } from './type-registry'
import { every, mapModuleDeclarations, relativeToAbsolutePath, when } from './utils'

type TypescriptWorker = Awaited<
  ReturnType<Monaco['languages']['typescript']['getTypeScriptWorker']>
>

type Model = ReturnType<Monaco['editor']['createModel']>

type Config = { cdn?: string; babel?: { presets?: string[]; plugins?: string[] } }
type Mandatory<TTarget, TKeys> = Required<Pick<TTarget, TKeys>> & Omit<TTarget, TKeys>

export class FileSystem {
  typeRegistry: TypeRegistry
  private files: Record<string, File>
  private setFiles: SetStoreFunction<Record<string, File>>
  private presets: Resource<any[]>
  config: Mandatory<Config, 'cdn'>
  constructor(
    public monaco: Monaco,
    public typescriptWorker: TypescriptWorker,
    config: Config,
  ) {
    this.config = mergeProps({ cdn: 'https://esm.sh' }, config)

    const [files, setFiles] = createStore<Record<string, File>>()
    this.typeRegistry = new TypeRegistry(monaco)
    this.files = files
    this.setFiles = setFiles
    const [presets] = createResource(
      () => this.config?.babel?.presets,
      presets =>
        Promise.all(
          presets.map(async preset => (await import(`${this.config.cdn}/${preset}`)).default),
        ),
    )
    this.presets = presets
  }

  static async create(monaco: Monaco, config: Config) {
    const typescriptWorker = await monaco.languages.typescript.getTypeScriptWorker()
    return new FileSystem(monaco, typescriptWorker, config)
  }

  create(path: string) {
    const file = new File(this, path, { presets: this.presets })
    this.setFiles(path, file)
    return file
  }

  has(path: string) {
    return path in this.files
  }

  get(path: string) {
    return this.files[path]
  }
}

class File {
  model: Model
  url: Accessor<string | undefined>
  module: Accessor<Record<string, any> | undefined>
  constructor(
    private fileSystem: FileSystem,
    path: string,
    config: {
      presets: Resource<any[]>
    },
  ) {
    const uri = fileSystem.monaco.Uri.parse(`file:///${path.replace('./', '')}`)
    this.model = fileSystem.monaco.editor.createModel('', 'typescript', uri)

    const [content, setContent] = createSignal<string | undefined>()
    const [transpiled] = createResource(
      every(content, config.presets),
      async ([content, presets]) => {
        try {
          let value: string = content
          if (path.split('.').pop() === 'ts') {
            const result = await fileSystem
              .typescriptWorker(this.model.uri)
              .then(result => result.getEmitOutput(`file://${this.model.uri.path}`))
              .then(result => result.outputFiles[0]?.text)
            if (!result) return undefined
            value = result
          }
          return Babel.transform(value, {
            presets: presets,
          }).code
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
          if (
            modulePath.startsWith('blob:') ||
            modulePath.startsWith('http:') ||
            modulePath.startsWith('https:')
          ) {
            return
          }
          if (modulePath.startsWith('.')) {
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
    const [module] = createResource(url, url => {
      if (!url) return undefined
      return import(url) as Record<string, any>
    })

    this.model.onDidChangeContent(() => setContent(this.model.getValue()))
    this.url = url
    this.module = module
  }

  set(value: string) {
    this.model.setValue(value)
  }
}
