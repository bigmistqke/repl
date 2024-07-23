import { createContext, useContext } from 'solid-js'
import { Runtime } from 'src/runtime/runtime'

export const runtimeContext = createContext<Runtime>()

/**
 * This hook facilitates the retrieval of the Repl-runtime, which includes the `FileSystem` and `FrameRegistry`.
 *
 * @returns {Runtime} The Repl context object containing references to the file system and frame registry.
 * @throws {Error} Throws an error if the hook is used outside of a component that is a descendant of the <Repl/> component.
 *
 * @example
 * const { fs, frames } = useRuntime();
 * // You can now interact with the file system or frame registry.
 */
export const useRuntime = (): Runtime => {
  const context = useContext(runtimeContext)
  if (!context) throw 'useRuntime should be used inside <Repl/>'
  return context
}
