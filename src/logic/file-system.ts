import { Monaco } from '@monaco-editor/loader'
import { Resource, createEffect, createResource, mergeProps } from 'solid-js'
import { SetStoreFunction, createStore } from 'solid-js/store'
import ts from 'typescript'
import { ReplConfig } from '../components/repl'
import {
  Mandatory,
  isRelativePath,
  isUrl,
  mapModuleDeclarations,
  relativeToAbsolutePath,
} from '../utils'
import { CssFile, File, JsFile } from './file'
import { PackageJsonParser } from './package-json'
import { TypeRegistry, TypeRegistryState } from './type-registry'

export type FileSystemState = {
  files: Record<string, string>
  types: TypeRegistryState
}

export type CompilationEvent = { url: string; path: string; fileSystem: FileSystem }
export type CompilationHandler = (event: CompilationEvent) => void
export class FileSystem {
  typeRegistry: TypeRegistry
  packageJsonParser = new PackageJsonParser()
  alias: Record<string, string>
  private setAlias: SetStoreFunction<Record<string, string>>
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
    ;[this.alias, this.setAlias] = createStore<Record<string, string>>({})
    ;[this.files, this.setFiles] = createStore<Record<string, File>>()
    ;[this.presets] = createResource(
      () => this.config?.babel?.presets || [],
      presets =>
        Promise.all(
          presets.map(async preset => (await import(`${this.config.cdn}/${preset}`)).default),
        ),
    )
    ;[this.plugins] = createResource(
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
  }

  initialize() {
    createEffect(() => {
      this.config.packages?.forEach(packageName => {
        this.typeRegistry.importTypesFromPackageName(packageName)
      })
    })

    if (this.config.initialState?.files) {
      Object.entries(this.config.initialState?.files).map(([path, source]) =>
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

    link.download = name
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
    const file = path.endsWith('.css')
      ? new CssFile(this, path)
      : new JsFile(this, path, { presets: this.presets, plugins: this.plugins })
    this.setFiles(path, file)
    return file
  }

  has(path: string) {
    return path in this.files
  }

  get(path: string) {
    return this.files[path]
  }

  addProject(files: Record<string, string>) {
    Object.entries(files).forEach(([path, value]) => {
      this.create(path).set(value)
    })
  }

  async addPackage(url: string) {
    const getVirtualPath = (url: string) => (isUrl(url) ? new URL(url).pathname : url)

    const { typesUrl, scriptUrl, packageName } = await this.packageJsonParser.parse(url)

    const project: Record<string, string> = {}
    const resolvePath = async (url: string) => {
      const virtualPath = getVirtualPath(url)

      const code = await fetch(url).then(response => {
        if (response.status !== 200) {
          throw new Error(`Error while loading ${url}: ${response.statusText}`)
        }
        return response.text()
      })

      const promises: Promise<void>[] = []

      const transformedCode = mapModuleDeclarations(virtualPath, code, node => {
        const specifier = node.moduleSpecifier as ts.StringLiteral
        const path = specifier.text
        if (isRelativePath(path)) {
          promises.push(resolvePath(relativeToAbsolutePath(url, path)))
        }
      })

      if (!transformedCode) {
        throw new Error(`Transform returned undefined for ${virtualPath}`)
      }

      await Promise.all(promises)

      project[virtualPath] = transformedCode
    }
    await resolvePath(scriptUrl)

    Object.entries(project).forEach(([path, value]) => {
      this.create(`node_modules${path}`).set(value)
    })

    if (typesUrl) {
      await this.typeRegistry.importTypesFromUrl(typesUrl, packageName)
    }

    this.setAlias(packageName, `node_modules${getVirtualPath(scriptUrl)}`)
  }

  // resolve path according to typescript-rules
  // NOTE:  should this update according to tsConfig.moduleResolution ?
  resolve(path: string) {
    return (
      this.files[path] ||
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
    return Object.fromEntries(
      Object.entries(this.files).filter(([path]) => path.split('/')[0] !== 'node_modules'),
    )
  }
}
