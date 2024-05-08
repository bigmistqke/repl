import { Accessor, Setter, createSignal } from 'solid-js'
import { Runtime } from '../runtime'
import { CssModule, JsModule, Module } from './module'

/**
 * Represents a generic file within the virtual file system, providing methods to manipulate and access the file's source code.
 * This is an abstract class and should be extended to handle specific types of files.
 */
export abstract class File {
  /** Represents a module associated with the file, must be defined by subclasses. */
  abstract module: Module
  /** Source code of the file as a reactive state. */
  private source: Accessor<string>
  /** Setter for the source state. */
  private setSource: Setter<string>
  /**
   * Constructs an instance of a Javascript file
   * @param repl - Reference to the ReplContext
   * @param path - Path in virtual file system
   */
  constructor(public path: string) {
    ;[this.source, this.setSource] = createSignal<string>('')
  }
  /**
   * Serializes the file's current state to a JSON-compatible string.
   * @returns The current source code of the file.
   */
  toJSON() {
    return this.source()
  }

  /**
   * Sets the source code of the file.
   * @param value - New source code to set.
   */
  set(value: string) {
    this.setSource(value)
  }

  /**
   * Retrieves the current source code of the file.
   * @returns The current source code.
   */
  get() {
    return this.source()
  }
}

/**
 * Represents a JavaScript file within the system. Extends the generic File class.
 */
export class JsFile extends File {
  /** Module associated with the JavaScript file, handling specific JavaScript interactions and execution. */
  module: JsModule
  constructor(
    public runtime: Runtime,
    public path: string,
  ) {
    super(path)
    this.module = new JsModule(runtime, this)
  }
}

/**
 * Represents a CSS file within the system. Extends the generic File class.
 */
export class CssFile extends File {
  /** Module associated with the CSS file, handling CSS-specific interactions and styling applications. */
  module: CssModule

  constructor(public path: string) {
    super(path)
    this.module = new CssModule(this)
  }
}
