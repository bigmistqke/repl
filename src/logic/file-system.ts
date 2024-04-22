import { Monaco } from '@monaco-editor/loader'
import { Resource, createEffect, createResource, mergeProps } from 'solid-js'
import { SetStoreFunction, createStore } from 'solid-js/store'
import { ReplConfig } from '../components/repl'
import { Mandatory } from '../utils'
import { File } from './file'
import { TypeRegistry, TypeRegistryState } from './type-registry'

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

  config: Mandatory<ReplConfig, 'cdn'>
  constructor(
    public monaco: Monaco,
    config: ReplConfig,
  ) {
    this.config = mergeProps({ cdn: 'https://esm.sh' }, config)
    this.typeRegistry = new TypeRegistry(monaco, { initialState: config.initialState?.types })

    const [files, setFiles] = createStore<Record<string, File>>()
    this.files = files
    this.setFiles = setFiles

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

    if (config.initialState?.files) {
      Object.entries(config.initialState?.files).map(([path, source]) =>
        this.create(path).set(source),
      )
    }
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
    this.setFiles(path, file)
    return file
  }

  has(path: string) {
    return path in this.files
  }

  get(path: string) {
    return this.files[path]
  }

  // resolve path according to typescript-rules
  // NOTE:  should this update according to tsConfig.moduleResolution ?
  resolve(path: string) {
    return (
      this.files[`${path}/index.ts`] ||
      this.files[`${path}/index.tsx`] ||
      this.files[`${path}/index.d.ts`] ||
      this.files[`${path}/index.js`] ||
      this.files[`${path}/index.jsx`] ||
      this.files[`${path}.ts`] ||
      this.files[`${path}.tsx`] ||
      this.files[`${path}.d.ts`] ||
      this.files[`${path}.js`] ||
      this.files[`${path}.jsx`]
    )
  }

  all() {
    return this.files
  }
}
