import { createContext, useContext } from 'solid-js'
import { FileSystem } from 'src/logic/file-system'
import { Frames } from 'src/logic/frames'

type ReplContext = { fs: FileSystem; frames: Frames }
export const replContext = createContext<ReplContext>()
export const useRepl = () => {
  const context = useContext(replContext)
  if (!context) throw 'useRepl should be used inside <Repl/>'
  return context
}
