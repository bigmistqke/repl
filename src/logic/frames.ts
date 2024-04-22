import { SetStoreFunction, createStore } from 'solid-js/store'

export class Frames {
  private frames: Record<string, Window>
  set: SetStoreFunction<Record<string, Window>>
  constructor() {
    const [frames, set] = createStore({})
    this.frames = frames
    this.set = set
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
