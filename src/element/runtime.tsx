import { Runtime } from '@bigmistqke/repl'
import { createRoot, createSignal } from 'solid-js'
import { ContextAttributes, createContext } from './context'

/**********************************************************************************/
/*                                                                                */
/*                                 Global Runtime                                 */
/*                                                                                */
/**********************************************************************************/

export const [runtime, setRuntime] = createRoot(() => {
  const [runtime, setRuntime] = createSignal<Runtime>()
  return [runtime, setRuntime]
})

export default { setRuntime }

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

export const useRuntime = createContext('repl-runtime', runtime)
