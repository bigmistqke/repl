import { createRoot, createSignal } from 'solid-js'
import { Runtime } from '../runtime'
import './devtools'
import './frame'

export const [runtime, setRuntime] = createRoot(() => {
  const [runtime, setRuntime] = createSignal<Runtime>()
  return [runtime, setRuntime]
})

export default { setRuntime }
