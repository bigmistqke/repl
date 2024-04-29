import { onCleanup } from 'solid-js'
import { SetStoreFunction, createStore } from 'solid-js/store'
import { when } from '..'
import { CssFile, JsFile } from './file'

/**
 * Manages a registry of frames, each associated with a distinct window object. This class facilitates
 * the creation, retrieval, and management of frame contexts, which are used to isolate environments
 * for executing JavaScript or CSS code.
 *
 * @class FrameRegistry
 */
export class FrameRegistry {
  /**
   * A record of Frame instances indexed by a unique name identifier.
   * @private
   */
  private frames: Record<string, Frame>
  /**
   * A setter function to update the frames record.
   * @private
   */
  private set: SetStoreFunction<Record<string, Frame>>

  /**
   * Initializes a new instance of FrameRegistry.
   */
  constructor() {
    ;[this.frames, this.set] = createStore({})
  }

  /**
   * Adds a new frame to the registry with the given name and window object. Used internally by `Repl.Frame`
   *
   * @param {string} name - The name to associate with the frame.
   * @param {Window} window - The window object of the frame.
   */
  add(name: string, window: Window) {
    this.set(name, new Frame(window))
  }

  /**
   * Deletes a frame from the registry by its name. Used internally by `Repl.Frame`.
   *
   * @param {string} name - The name of the frame to delete.
   */
  delete(name: string) {
    this.set(name, undefined!)
  }

  /**
   * Retrieves a frame by its name.
   *
   * @param {string} name - The name of the frame to retrieve.
   * @returns {Frame | undefined} The frame associated with the given name, if it exists.
   */
  get(name: string) {
    return this.frames[name]
  }

  /**
   * Checks if a frame with the given name exists in the registry.
   *
   * @param {string} name - The name to check.
   * @returns {boolean} True if the frame exists, false otherwise.
   */
  has(name: string) {
    return name in this.frames
  }
}

/**
 * Represents an individual frame within the application, managing its associated window and the
 * injection of script elements for executing file content within that environment.
 *
 * @class Frame
 */
class Frame {
  /**
   * Constructs a Frame instance associated with a given window.
   *
   * @param {Window} window - The window object associated with this frame.
   */
  constructor(
    /** The window object associated with this frame, typically an iframe's window. */
    public window: Window,
  ) {}

  /**
   * Injects a script element into the frame's document to load and execute a file's module.
   * The file must have a URL accessible via its `moduleUrl` property.
   *
   * @param {CssFile | JsFile} file - The file to inject, which could be a `CssFile` or `JsFile`.
   * @returns {HTMLScriptElement} The script element that was injected.
   */
  injectFile(file: CssFile | JsFile) {
    return when(file.moduleUrl)(moduleUrl => {
      const script = this.window.document.createElement('script')
      script.type = 'module'
      script.src = moduleUrl
      this.window.document.head.appendChild(script)
      onCleanup(() => this.window.document.head.removeChild(script))
      return script
    })
  }
}
