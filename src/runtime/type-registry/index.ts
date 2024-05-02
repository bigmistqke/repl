import { batch } from 'solid-js'
import { SetStoreFunction, createStore } from 'solid-js/store'
import { Runtime } from '../runtime'
import { TypeImportUtils } from './type-import-utils'

export type TypeRegistryState = {
  alias: Record<string, string[]>
  sources: Record<string, string>
}

/**
 * Manages the registry of TypeScript types across the application, facilitating type definition management
 * and providing utilities for importing and resolving TypeScript definitions from various sources.
 * This class is crucial for maintaining type accuracy and enabling IntelliSense in the editor.
 *
 * @class TypeRegistry
 */
export class TypeRegistry {
  sources: Record<string, string>
  private setSources: SetStoreFunction<Record<string, string>>
  alias: Record<string, string[]>
  private setAlias: SetStoreFunction<Record<string, string[]>>
  import: TypeImportUtils

  /**
   * Initializes a new instance of the TypeRegistry class.
   *
   * @param runtime The repl-instance that interacts with this type registry.
   */
  constructor(public runtime: Runtime) {
    ;[this.sources, this.setSources] = createStore({})
    ;[this.alias, this.setAlias] = createStore({})
    this.import = new TypeImportUtils(runtime, this)
  }

  /**
   * Converts the current state of the type registry into a JSON object.
   *
   * @returns The current state of the type registry.
   */
  toJSON(): TypeRegistryState {
    return {
      alias: this.alias,
      sources: this.sources,
    }
  }

  /**
   * Initializes the registry with a predefined state, setting up known types and aliases.
   *
   * @param initialState The initial state to load into the registry.
   */
  initialize(initialState: Partial<TypeRegistryState>) {
    batch(() => {
      if (initialState.sources) {
        this.setSources(initialState.sources)
      }
      if (initialState.alias) {
        this.setAlias(initialState.alias)
        Object.entries(initialState.alias).forEach(([key, value]) => {
          this.aliasPath(key, value[0]!)
        })
      }
    })
    this.import.initialize(initialState)
  }

  /**
   * Adds or updates a path in the TypeScript configuration to map to an aliased package.
   *
   * @param packageName The package name to alias.
   * @param virtualPath The virtual path that the alias points to.
   * @private
   */
  aliasPath(packageName: string, virtualPath: string) {
    this.setAlias(packageName, [virtualPath])
  }

  /**
   * Adds or updates a type definition source to the registry.
   *
   * @param path The path of the type definition file.
   * @param value The content of the type definition file.
   * @private
   */
  set(path: string, value: string) {
    this.setSources(path, value)
  }

  /**
   * Checks if a specific path is already registered in the type sources.
   *
   * @param path The path to check.
   * @returns True if the path is registered, false otherwise.
   * @private
   */
  has(path: string) {
    return path in this.sources
  }
}
