import { SetStoreFunction, createStore } from 'solid-js/store'
import { Frame } from './frame'

/**
 * Manages a registry of `Frame`s, each associated with its distinct `Window`. This class handles
 * the creation, retrieval, and management of `Frame` instances.
 *
 * @class FrameRegistry
 */
export class FrameRegistry {
  /** A record of Frame instances indexed by a unique name identifier. */
  #frames: Record<string, Frame>
  /** A setter function to update the frames record. */
  #setFrames: SetStoreFunction<Record<string, Frame>>

  constructor() {
    ;[this.#frames, this.#setFrames] = createStore({})
  }

  /**
   * Adds a new frame to the registry with the given name and window object. Used internally by `Frame`
   *
   * @param name - The name to associate with the frame.
   * @param window - The window object of the frame.
   */
  add(name: string, frame: Frame) {
    this.#setFrames(name, frame)
  }

  /**
   * Deletes a frame from the registry by its name. Used internally by `Frame`.
   *
   * @param name - The name of the frame to delete.
   */
  delete(name: string) {
    this.#setFrames(name, undefined!)
  }

  /**
   * Retrieves a frame by its name.
   *
   * @param name - The name of the frame to retrieve.
   * @returns The frame associated with the given name, if it exists.
   */
  get(name: string) {
    return this.#frames[name]
  }

  /**
   * Checks if a frame with the given name exists in the registry.
   *
   * @param {string} name - The name to check.
   * @returns True if the frame exists, false otherwise.
   */
  has(name: string) {
    return name in this.#frames
  }
}
