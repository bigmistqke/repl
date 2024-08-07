import { Accessor, Setter, createSignal } from 'solid-js'
import { Runtime } from '../runtime'

/**
 * Represents a generic file within the virtual file system, providing methods to manipulate and access the file's source code.
 * This is an abstract class and should be extended to handle specific types of files.
 */
export abstract class AbstractFile {
  /**
   * Generates a new URL for an ES Module based on the current source code. This URL is not cached,
   * ensuring that each call provides a fresh module.
   * @returns A string representing the URL, or undefined if it cannot be generated.
   */
  abstract generate(): string | undefined
  /** The current URL of the loaded module, if available. */
  abstract url: string | undefined

  /** Source code of the file as a reactive state. */
  #source: Accessor<string>
  /** Setter for the source state. */
  #setSource: Setter<string>
  /** Derived state if the file is controlled. */
  #controlled: () => boolean

  /**
   * Constructs an instance of a Javascript file
   * @param repl - Reference to the ReplContext
   * @param path - Path in virtual file system
   */
  constructor(
    public runtime: Runtime,
    public path: string,
    /** If undefined controlled state will be derived from Runtime.config.controlled */
    controlled?: boolean,
  ) {
    ;[this.#source, this.#setSource] = createSignal<string>('')
    this.#controlled = () => (controlled !== undefined ? controlled : !!runtime.config.controlled)
  }

  /**
   * Serializes the file's current state to a JSON-compatible string.
   * @returns The current source code of the file.
   */
  toJSON() {
    return this.get()
  }

  /**
   * Sets the source code of the file.
   * @param value - New source code to set.
   */
  set(value: string) {
    this.runtime.config.onFileChange?.(this.path, value)
    if (!this.#controlled()) {
      this.#setSource(value)
    }
  }

  /**
   * Retrieves the current source code of the file.
   * @returns The current source code.
   */
  get() {
    return this.#controlled() ? this.runtime.config.files![this.path]! : this.#source()
  }

  moduleTransform(): string | null {
    const url = this.url
    if (!url) throw `Currently module-url of ${this.path} is undefined.`
    return url
  }
}
