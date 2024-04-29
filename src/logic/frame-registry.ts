import { onCleanup } from 'solid-js'
import { SetStoreFunction, createStore } from 'solid-js/store'
import { when } from '..'
import { CssFile, JsFile } from './file'

export class FrameRegistry {
  private frames: Record<string, Frame>
  private set: SetStoreFunction<Record<string, Frame>>
  constructor() {
    ;[this.frames, this.set] = createStore({})
  }
  add(name: string, window: Window) {
    this.set(name, new Frame(window))
  }
  get(name: string) {
    return this.frames[name]
  }
  has(name: string) {
    return name in this.frames
  }
  delete(name: string) {
    this.set(name, undefined!)
  }
}

class Frame {
  constructor(public window: Window) {}
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
