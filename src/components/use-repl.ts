import { createContext, useContext } from 'solid-js'
import { ReplContext } from 'src/logic/repl-context'

const replContext = createContext<ReplContext>()
export const ReplContextProvider = replContext.Provider

/**
 * This hook facilitates the retrieval  of the Repl context, which includes the `FileSystem` and `FrameRegistry`.
 *
 * @returns {ReplContext} The Repl context object containing references to the file system and frame registry.
 * @throws {Error} Throws an error if the hook is used outside of a component that is a descendant of the <Repl/> component.
 *
 * @example
 * const { fs, frames } = useRepl();
 * // You can now interact with the file system or frame registry.
 */
export const useRepl = (): ReplContext => {
  const context = useContext(replContext)
  if (!context) throw 'useRepl should be used inside <Repl/>'
  return context
}
