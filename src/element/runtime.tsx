import { Runtime } from '@bigmistqke/repl'
import { Element } from '@lume/element'
import { createRoot, createSignal } from 'solid-js'
import { ContextAttributes, createContext } from './context'

/**********************************************************************************/
/*                                                                                */
/*                                 Global Runtime                                 */
/*                                                                                */
/**********************************************************************************/

const [runtime, _setRuntime] = createRoot(() => {
  const [runtime, setRuntime] = createSignal<Runtime>()
  return [runtime, setRuntime]
})

export const setRuntime = _setRuntime

/**********************************************************************************/
/*                                                                                */
/*                                      Types                                     */
/*                                                                                */
/**********************************************************************************/

type ReplRuntimeAttributes = ContextAttributes<Runtime | undefined>

declare module 'solid-js/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      'repl-runtime': ReplRuntimeAttributes
    }
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'repl-runtime': ReplRuntimeAttributes
    }
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                  Repl Runtime                                  */
/*                                                                                */
/**********************************************************************************/

const useContext = createContext('repl-runtime', runtime)
export function useRuntime(element: Element & { runtime: Runtime | undefined | null }) {
  const runtime = useContext(element)
  return () => (element.runtime === null ? runtime() : element.runtime)
}
