import * as Babel from '@babel/standalone'
import { Monaco } from '@monaco-editor/loader'
import { mergeProps } from 'solid-js'
import type ts from 'typescript'
import type { SourceFile } from 'typescript'
import type { Mandatory } from '..'
import { FileSystem, FileSystemState } from './file-system'
import { FrameRegistry } from './frame-registry'
import { TypeRegistry, TypeRegistryState } from './type-registry'

export type ReplState = {
  files: FileSystemState
  types: TypeRegistryState
}

export type InitialReplState = Partial<{
  files: Partial<FileSystemState>
  types: Partial<TypeRegistryState>
}>

export type TypescriptConfig = Parameters<
  Monaco['languages']['typescript']['typescriptDefaults']['setCompilerOptions']
>[0]
export type BabelConfig = Partial<{ presets: string[]; plugins: (string | babel.PluginItem)[] }>
export type ReplConfig = Partial<{
  /** Configuration options for Babel, used for code transformation. */
  babel: BabelConfig
  /** The CDN URL used to load TypeScript and other external libraries. */
  cdn: string
  /** CSS class for styling the root REPL component. */
  class: string
  /** Initial state of the virtual file system to preload files. */
  initialState: InitialReplState
  /** Theme setting for the Monaco editor. */
  mode: 'light' | 'dark'
  /** Callback function that runs after initializing the editor and file system. */
  onSetup: (repl: ReplContext) => Promise<void> | void
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
export class ReplContext {
  /**
   * Configuration for the file system, requiring 'cdn' as a mandatory setting.
   */
  config: Mandatory<ReplConfig, 'cdn'>
  fileSystem: FileSystem
  frameRegistry: FrameRegistry
  /**
   * Manages TypeScript declaration-files.
   */
  typeRegistry: TypeRegistry

  constructor(
    /** An object containing references to external libraries utilized by the REPL. */
    public libs: {
      // /** An instance of Monaco, used for powering the code editor in the REPL. */
      // monaco: Monaco
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
    config: ReplConfig,
  ) {
    this.config = mergeProps({ cdn: 'https://esm.sh' }, config)
    this.frameRegistry = new FrameRegistry()
    this.fileSystem = new FileSystem(this)
    this.typeRegistry = new TypeRegistry(this)
  }

  /**
   * Serializes the current state of the repl into JSON format.
   *
   * @returns JSON representation of the repl state.
   */
  toJSON(): ReplState {
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
   * Transforms module declarations (import/export) within a TypeScript code file, according to the provided callback function.
   * The callback can modify the nodes by returning updated nodes, or it can signal to remove nodes by returning `false`.
   * If an exception is thrown within the callback, it breaks the execution of the function.
   *
   * @param path - The path of the source file to be modified.
   * @param code - The TypeScript code as a string.
   * @param callback - Callback function to apply on each import or export declaration node. This function can return `false` to signal the removal of the node from the code, or modify the node directly. The execution is stopped if the callback throws an error.
   * @returns - The transformed code as a string. Returns `undefined` if no transformations were made to the original code or if no changes are detected.
   */
  mapModuleDeclarations(
    path: string,
    code: string,
    //** Callback to modify module-declaration node. Return `false` to remove node from code. `Throw` to break execution. */
    callback: (node: ts.ImportDeclaration | ts.ExportDeclaration) => void | false,
  ) {
    const sourceFile = this.libs.typescript.createSourceFile(
      path,
      code,
      this.libs.typescript.ScriptTarget.Latest,
      true,
      this.libs.typescript.ScriptKind.TS,
    )
    let shouldPrint = false
    const result = this.libs.typescript.transform(sourceFile, [
      context => {
        const visit: ts.Visitor = node => {
          if (
            (this.libs.typescript.isImportDeclaration(node) ||
              this.libs.typescript.isExportDeclaration(node)) &&
            node.moduleSpecifier &&
            this.libs.typescript.isStringLiteral(node.moduleSpecifier)
          ) {
            const isImport = this.libs.typescript.isImportDeclaration(node)

            const previous = node.moduleSpecifier.text

            if (callback(node) === false) {
              shouldPrint = true
              return
            }

            if (previous !== node.moduleSpecifier.text) {
              shouldPrint = true
              if (isImport) {
                return this.libs.typescript.factory.updateImportDeclaration(
                  node,
                  node.modifiers,
                  node.importClause,
                  this.libs.typescript.factory.createStringLiteral(node.moduleSpecifier.text),
                  node.assertClause, // Preserve the assert clause if it exists
                )
              } else {
                return this.libs.typescript.factory.updateExportDeclaration(
                  node,
                  node.modifiers,
                  false,
                  node.exportClause,
                  this.libs.typescript.factory.createStringLiteral(node.moduleSpecifier.text),
                  node.assertClause, // Preserve the assert clause if it exists
                )
              }
            }
          }
          return this.libs.typescript.visitEachChild(node, visit, context)
        }
        return node => this.libs.typescript.visitNode(node, visit) as SourceFile
      },
    ])
    if (!result.transformed[0]) return undefined
    if (!shouldPrint) return code
    const printer = this.libs.typescript.createPrinter({
      newLine: this.libs.typescript.NewLineKind.LineFeed,
    })
    return printer.printFile(result.transformed[0])
  }
}
