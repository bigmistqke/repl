import { Accessor, Setter, createSignal } from 'solid-js'
import { CssModule, JsModule, Module } from './module'
import { ReplContext } from './repl-context'

export abstract class File {
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

export class JsFile extends File {
  module: JsModule
  constructor(
    public repl: ReplContext,
    public path: string,
  ) {
    super(path)
    this.module = new JsModule(repl, this)
  }
}

export class CssFile extends File {
  module: CssModule
  constructor(public path: string) {
    super(path)
    this.module = new CssModule(this)
  }
}
