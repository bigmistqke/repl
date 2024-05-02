import * as Babel from '@babel/standalone'
import { Monaco } from '@monaco-editor/loader'
import { PackageJsonParser } from 'dist/plugins'
import { createEffect, createResource, mergeProps } from 'solid-js'
import { whenever } from 'src/utils/conditionals'
import { isRelativePath, isUrl, relativeToAbsolutePath } from 'src/utils/path'
import type { Mandatory } from 'src/utils/type'
import type ts from 'typescript'
import { FileSystem, FileSystemState } from './file-system'
import { FrameRegistry } from './frame-registry'
import { TypeRegistry, TypeRegistryState } from './type-registry'
import { Utils } from './utils'

export type RuntimeState = {
  files: FileSystemState
  types: TypeRegistryState
}

export type InitialState = Partial<{
  files: Partial<FileSystemState>
  types: Partial<TypeRegistryState>
}>

export type TypescriptConfig = Parameters<
  Monaco['languages']['typescript']['typescriptDefaults']['setCompilerOptions']
>[0]
export type BabelConfig = Partial<{ presets: string[]; plugins: (string | babel.PluginItem)[] }>
export type RuntimeConfig = Partial<{
  /** Configuration options for Babel, used for code transformation. */
  babel: BabelConfig
  /** The CDN URL used to load TypeScript and other external libraries. */
  cdn: string
  /** CSS class for styling the root REPL component. */
  class: string
  /** Initial state of the virtual file system to preload files. */
  initialState: InitialState
  /** Theme setting for the Monaco editor. */
  mode: 'light' | 'dark'
  /** Callback function that runs after initializing the editor and file system. */
  onSetup: (runtime: Runtime) => Promise<void> | void
  /** TypeScript compiler options for the Monaco editor. */
  typescript: TypescriptConfig
  /** Optional actions like saving the current state of the REPL. */
  actions?: {
    saveRepl?: boolean
  }
}>

/**
 * Provides a centralized context for managing the REPL (Read-Eval-Print Loop) environment.
 * This class is responsible for handling and integrating the core libraries and configurations necessary for the REPL's operation.
 * It maintains references to the file system and frame management systems, along with essential development libraries.
 */
export class Runtime {
  /**
   * Configuration for the file system, requiring 'cdn' as a mandatory setting.
   */
  config: Mandatory<RuntimeConfig, 'cdn'>
  fileSystem: FileSystem
  frameRegistry: FrameRegistry
  /**
   * Manages TypeScript declaration-files.
   */
  typeRegistry: TypeRegistry
  /**
   * Utility to parse package.json files for module management.
   */
  packageJsonParser: PackageJsonParser
  utils: Utils

  constructor(
    /** An object containing references to external libraries utilized by the REPL. */
    public libs: {
      /**  The TypeScript library used for TypeScript code operations and transformations. */
      typescript: typeof ts
      /** The Babel library used for JavaScript code transformation. */
      babel: typeof Babel | undefined
      /** Babel presets used for transpiling files. */
      babelPresets: any[] | undefined
      /** Babel plugins used for transpiling files. */
      babelPlugins: babel.PluginItem[] | undefined
    },
    /** Configuration settings for the file system within the REPL, used to initialize the FileSystem instance. */
    config: RuntimeConfig,
  ) {
    this.config = mergeProps({ cdn: 'https://esm.sh' }, config)
    this.frameRegistry = new FrameRegistry()
    this.fileSystem = new FileSystem(this)
    this.typeRegistry = new TypeRegistry(this)
    this.packageJsonParser = new PackageJsonParser()
    this.utils = new Utils(this)
  }

  /**
   * Serializes the current state of the repl into JSON format.
   *
   * @returns JSON representation of the repl state.
   */
  toJSON(): RuntimeState {
    return {
      files: this.fileSystem.toJSON(),
      types: this.typeRegistry.toJSON(),
    }
  }

  /**
   * Initializes the file system based on provided initial configuration, setting up files and types.
   */
  initialize() {
    const initialState = this.config.initialState
    if (initialState) {
      if (initialState.types) {
        this.typeRegistry.initialize(initialState.types)
      }
      if (initialState.files) {
        this.fileSystem.initialize(initialState.files)
      }
    }
  }

  /**
   * Triggers a download of the current repl-state as a JSON file.
   *
   * @param [name='repl.config.json'] - Name of the file to download.
   */
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

  /**
   * Imports a package from a specified URL by parsing its package.json and loading its main script and types.
   * This method handles resolving paths, fetching content, and transforming module declarations to maintain compatibility.
   *
   * @param url - The URL to the package.json of the package to import.
   * @returns A promise that resolves when the package has been fully imported.
   * @async
   */
  async importFromPackageJson(url: string) {
    const getVirtualPath = (url: string) => (isUrl(url) ? new URL(url).pathname : url)

    const [packageJson] = createResource(() => this.packageJsonParser.parse(url))
    const [project] = createResource(packageJson, async ({ scriptUrl, packageName }) => {
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

        const transformedCode = this.utils.mapModuleDeclarations(virtualPath, code, node => {
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

      this.fileSystem.setAlias(packageName, `node_modules${getVirtualPath(scriptUrl)}`)

      return project
    })

    createEffect(
      whenever(packageJson, ({ typesUrl, packageName }) => {
        if (typesUrl) this.typeRegistry.import.fromUrl(typesUrl, packageName)
      }),
    )

    createEffect(
      whenever(project, project =>
        Object.entries(project).forEach(([path, value]) => {
          this.fileSystem.create(`node_modules${path}`).set(value)
        }),
      ),
    )
  }
}
