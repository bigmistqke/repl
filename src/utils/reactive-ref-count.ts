import { ReactiveMap } from '@solid-primitives/map'
import { createMemo, createRoot, EffectFunction, getListener, onCleanup, untrack } from 'solid-js'

interface Ref<T> {
  count: number
  value: T
  dispose(): void
}
export class ReactiveRefCount<T> {
  map = new ReactiveMap<string, Ref<T>>()
  constructor(public cb: (key: string) => T) {}
  get(ikey: string): T | undefined {
    return this.map.get(ikey)?.value
  }
  isNull(key: string) {
    return this.map.get(key)?.count === 0
  }
  delete(key: string): boolean {
    this.map.get(key)?.dispose()
    return this.map.delete(key)
  }
  track(key: string): T {
    const hasListener = getListener()

    const ref = untrack(() => this.map.get(key))

    if (hasListener) {
      onCleanup(() => {
        queueMicrotask(() => {
          const ref = this.map.get(key)
          if (ref) {
            ref.count--
          }
        })
      })
    }

    if (ref) {
      if (hasListener) {
        ref.count++
      }
      return ref.value
    } else {
      return createRoot(dispose => {
        const value = this.cb(key)
        this.map.set(key, {
          count: hasListener ? 1 : 0,
          value,
          dispose,
        })
        return value
      })
    }
  }
  memo<Next extends Prev, Prev = Next>(key: string, cb: EffectFunction<Prev, Next>) {
    return createMemo<Next, Prev>((prev: Prev) => {
      if (untrack(() => this.map.get(key)?.count) === 0 && prev) {
        return prev
      }
      return cb(prev)
    })
  }
}
