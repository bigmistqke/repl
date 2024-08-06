import { mergeProps } from 'solid-js'
import type { Mandatory } from 'src/utils/type'
import { FileSystem, FileSystemState } from './file-system'
import { CssFile, JsFile, VirtualFile, WasmFile } from './file-system/file'
import { FrameRegistry } from './frame-registry'
import { ImportUtils } from './import-utils'
import { TypeRegistry, TypeRegistryState } from './type-registry'

export interface RuntimeState {
  files: FileSystemState
  types: TypeRegistryState
}

export interface InitialState {
  files?: Partial<FileSystemState>
  types?: Partial<TypeRegistryState>
}

export type Transform = (source: string, path: string) => string
export type TransformModulePaths = (
  source: string,
  callback: (value: string) => string | null,
) => string | undefined

interface RuntimeConfigBase {
  /** The CDN URL used to load TypeScript and other external libraries. */
  cdn?: string
  /** CSS class for styling the root REPL component. */
  class?: string
  /** Log internal events. */
  debug?: boolean
  /** Import external types from the cdn. */
  importExternalTypes?: boolean
  /**
   * Function to transform the source code.
   * @param source - The source code to transform.
   * @param path - The path of the source file.
   * @returns The transformed source code.
   */
  transform: Transform
  /**
   * Function to transform module paths.
   * @param source - The source code containing module paths.
   * @param callback - A callback function to transform each module path.
   * @returns The transformed module-path or null (will remove the module-declaration).
   */
  transformModulePaths: TransformModulePaths
  /** Optional event that runs after initializing the editor and file system. */
  onSetup?: (runtime: Runtime) => Promise<void> | void
  /** Optional event that runs after a file's source is updated. */
  onFileChange?: (path: string, src: string) => void
  /** Additional extensions besides .js and .css */
  extensions?: Record<string, (runtime: Runtime, path: string) => VirtualFile>
}

interface RuntimeConfigControlled extends RuntimeConfigBase {
  /** Sources of the virtual file system to preload files. Controlled mode. */
  files: Record<string, string>
  /** Optional boolean controlling if files should maintain their own state or if the file's sources should be derived from `config.files`. Defaults to `false`. */
  controlled: true
}

interface RuntimeConfigUncontrolled extends RuntimeConfigBase {
  /** Sources of the virtual file system to preload files. Controlled mode. */
  files?: Record<string, string>
  /** Optional boolean controlling if files should maintain their own state or if the file's sources should be derived from `config.files`. Defaults to `false`. */
  controlled?: false
}

export type RuntimeConfig = RuntimeConfigControlled | RuntimeConfigUncontrolled

type FileFactory<T extends VirtualFile> = (runtime: Runtime, path: string) => T

// Create a type for the specific methods
interface DefinedExtensions {
  css: FileFactory<CssFile>
  js: FileFactory<JsFile>
  jsx: FileFactory<JsFile>
  ts: FileFactory<JsFile>
  tsx: FileFactory<JsFile>
  wasm: FileFactory<WasmFile>
}

// Use an index signature for all other keys
interface GenericFileMethods {
  [key: string]: FileFactory<VirtualFile>
}

// Combine the specific and generic file methods into one type
type Extensions = DefinedExtensions & GenericFileMethods

/**
 * Provides a centralized context for managing the `Repl` runtime environment.
 * This class is responsible for handling and integrating the core libraries and configurations necessary for the `Repl`'s operation.
 * It maintains references to the file system, frame management systems, and essential development libraries.
 */
export class Runtime {
  /** Configurations for the runtime environment. Ensures mandatory settings like 'cdn' are always included. */
  config: Mandatory<RuntimeConfig, 'cdn'>
  /** Manages file operations within the virtual file system. */
  fileSystem: FileSystem
  /** Handles the registration and management of iframe containers for isolated code execution. */
  frameRegistry: FrameRegistry
  /** Manages TypeScript declaration files and other type-related functionality. */
  typeRegistry: TypeRegistry
  /** Utility class for handling imports from URLS pointing to non-esm packages. */
  import: ImportUtils
  /**  */
  get extensions(): Extensions {
    return {
      css: (runtime, path) => new CssFile(runtime, path),
      js: (runtime, path) => new JsFile(runtime, path),
      jsx: (runtime, path) => new JsFile(runtime, path),
      ts: (runtime, path) => new JsFile(runtime, path),
      tsx: (runtime, path) => new JsFile(runtime, path),
      wasm: (runtime, path) => new WasmFile(runtime, path),
      ...this.config.extensions,
    }
  }
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
   * @returns JSON representation of the repl state.
   */
  toJSON(): RuntimeState {
    return {
      files: this.fileSystem.toJSON(),
      types: this.typeRegistry.toJSON(),
    }
  }

  /** Initializes the file system based on provided initial configuration, setting up files and types. */
  initialize() {
    if (this.config.files) {
      this.fileSystem.initialize(this.config.files)
    }
    this.initialized = true
  }

  /**
   * Triggers a download of the current repl-state as a JSON file.
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
