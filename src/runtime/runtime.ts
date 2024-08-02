import { mergeProps } from 'solid-js'
import type { Mandatory } from 'src/utils/type'
import { FileSystem, FileSystemState } from './file-system'
import { FrameRegistry } from './frame-registry'
import { ImportUtils } from './import-utils'
import { TypeRegistry, TypeRegistryState } from './type-registry'

export type RuntimeState = {
  files: FileSystemState
  types: TypeRegistryState
}

export type InitialState = Partial<{
  files: Partial<FileSystemState>
  types: Partial<TypeRegistryState>
}>

export type Transform = (source: string, path: string) => string
export type TransformModulePaths = (
  source: string,
  callback: (value: string) => string | null,
) => string | undefined

export type RuntimeConfig = {
  /** Optional actions like saving the current state of the REPL. */
  actions?: {
    saveRepl?: boolean
  }
  /** The CDN URL used to load TypeScript and other external libraries. */
  cdn?: string
  /** CSS class for styling the root REPL component. */
  class?: string
  /** Initial state of the virtual file system to preload files. */
  initialState?: InitialState
  /** Import external types from the cdn. */
  importExternalTypes?: boolean
  /** Log internal events. */
  debug?: boolean
  /** Callback function that runs after initializing the editor and file system. */
  onSetup?: (runtime: Runtime) => Promise<void> | void
  transformModulePaths: TransformModulePaths
  transform: Transform
}

/**
 * Provides a centralized context for managing the `Repl` runtime environment.
 * This class is responsible for handling and integrating the core libraries and configurations necessary for the `Repl`'s operation.
 * It maintains references to the file system, frame management systems, and essential development libraries.
 */
export class Runtime {
  /**
   * Configurations for the runtime environment. Ensures mandatory settings like 'cdn' are always included.
   */
  config: Mandatory<RuntimeConfig, 'cdn'>
  /**
   * Manages file operations within the virtual file system.
   */
  fileSystem: FileSystem
  /**
   * Handles the registration and management of iframe containers for isolated code execution.
   */
  frameRegistry: FrameRegistry
  /**
   * Manages TypeScript declaration files and other type-related functionality.
   */
  typeRegistry: TypeRegistry
  // /**
  //  * Utility class for transpiling code with configured Babel presets and plugins.
  //  */
  // transpiler: Transpiler
  /**
   * Utility class for handling imports from URLS pointing to non-esm packages.
   */
  import: ImportUtils

  initialized = false

  constructor(
    /** Configuration settings for the file system within the REPL runtime, used to initialize the FileSystem instance. */
    config: RuntimeConfig,
  ) {
    this.config = mergeProps({ cdn: 'https://esm.sh' }, config)
    this.fileSystem = new FileSystem(this)
    this.frameRegistry = new FrameRegistry()
    this.import = new ImportUtils(this)
    this.typeRegistry = new TypeRegistry(this)
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
    this.initialized = true
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
}
