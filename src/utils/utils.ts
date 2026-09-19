import { ReactiveMap } from '@solid-primitives/map'
import {
  type Accessor,
  type ComputeFunction,
  createMemo,
  createRoot,
  getObserver,
  onCleanup,
  runWithOwner,
  untrack,
} from 'solid-js'
import { type AccessorMaybe } from '../types.ts'

/**********************************************************************************/
/*                                                                                */
/*                                   Access Maybe                                 */
/*                                                                                */
/**********************************************************************************/

export function accessMaybe<T>(maybeAccessor: Accessor<T> | T): T {
  if (isAccessor(maybeAccessor)) {
    return maybeAccessor()
  }
  return maybeAccessor
}

/**********************************************************************************/
/*                                                                                */
/*                                      Defer                                     */
/*                                                                                */
/**********************************************************************************/

export function defer<T = void>() {
  let resolve: (value: T) => void = null!
  return {
    promise: new Promise<T>(_resolve => (resolve = _resolve)),
    resolve,
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                   Is Accessor                                  */
/*                                                                                */
/**********************************************************************************/

function isAccessor<T>(value: AccessorMaybe<T>): value is Accessor<T> {
  return typeof value === 'function'
}

/**********************************************************************************/
/*                                                                                */
/*                                       Last                                     */
/*                                                                                */
/**********************************************************************************/

export function last<T>(array: Array<T>) {
  return array[array.length - 1]
}

/**********************************************************************************/
/*                                                                                */
/*                                    Map Object                                  */
/*                                                                                */
/**********************************************************************************/

export function mapObject<T, U>(
  object: Record<string, T>,
  callback: (value: T, path: string) => U,
): Record<string, U> {
  return Object.fromEntries(
    Object.entries(object).map(entry => [entry[0], callback(entry[1], entry[0])]),
  )
}

/**********************************************************************************/
/*                                                                                */
/*                               Reactive Ref Count                               */
/*                                                                                */
/**********************************************************************************/

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
    const hasListener = getObserver()

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
      // Force a truly detached root: this factory can run reentrantly from
      // inside another path's own computation (e.g. an html file's
      // transform reading a referenced script's url), and createRoot alone
      // does not escape that ambient owner — without this, the new root
      // gets disposed whenever that reentrant caller's own scope next
      // reruns, even though nothing here actually depends on it.
      return runWithOwner(null, () =>
        createRoot(dispose => {
          const value = this.cb(key)
          this.map.set(key, {
            count: hasListener ? 1 : 0,
            value,
            dispose,
          })
          return value
        }),
      )
    }
  }
  memo<Next extends Prev, Prev = Next>(key: string, cb: ComputeFunction<Prev, Next>) {
    return createMemo<Next>((prev): Next => {
      if (untrack(() => this.map.get(key)?.count) === 0 && prev) {
        return prev as Next
      }
      return cb(prev as Prev) as Next
    })
  }
}
