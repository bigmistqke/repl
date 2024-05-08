import { createContext, useContext } from 'solid-js'
import { Runtime } from 'src/runtime/runtime'

const replContext = createContext<Runtime>()
export const RuntimeProvider = replContext.Provider

/**
 * This hook facilitates the retrieval of the Repl-runtime, which includes the `FileSystem` and `FrameRegistry`.
 *
 * @returns {Runtime} The Repl context object containing references to the file system and frame registry.
 * @throws {Error} Throws an error if the hook is used outside of a component that is a descendant of the <Repl/> component.
 *
 * @example
 * const { fs, frames } = useRepl();
 * // You can now interact with the file system or frame registry.
 */
export const useRepl = (): Runtime => {
  const context = useContext(replContext)
  if (!context) throw 'useRepl should be used inside <Repl/>'
  return context
}
