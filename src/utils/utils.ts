import { ReactiveMap } from '@solid-primitives/map'
import {
  type Accessor,
  createMemo,
  createResource,
  createRoot,
  type EffectFunction,
  getListener,
  type InitializedResource,
  onCleanup,
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
/*                                   Create Async                                 */
/*                                                                                */
/**********************************************************************************/

// interpolated from https://raw.githubusercontent.com/solidjs/solid-router/50c5d7bdef6acc5910c6eb35ba6a24b15aae3ef6/src/data/createAsync.ts

/**
 * As `createAsync` and `createAsyncStore` are wrappers for `createResource`,
 * this type allows to support `latest` field for these primitives.
 * It will be removed in the future.
 */
export type AccessorWithLatest<T> = {
  (): T
  latest: T
}

export function createAsync<T>(
  fn: (prev: T) => T | Promise<T>,
  options: {
    name?: string
    initialValue: T
    deferStream?: boolean
  },
): AccessorWithLatest<T>
export function createAsync<T>(
  fn: (prev: T | undefined) => T | Promise<T>,
  options?: {
    name?: string
    initialValue?: T
    deferStream?: boolean
  },
): AccessorWithLatest<T | undefined>
export function createAsync<T>(
  fn: (prev: T | undefined) => T | Promise<T>,
  options?: {
    name?: string
    initialValue?: T
    deferStream?: boolean
  },
): AccessorWithLatest<T | undefined> {
  let resource: InitializedResource<T> | null = null

  const prev = () =>
    !resource || (resource as any).state === 'unresolved' ? undefined : (resource as any).latest

  resource = createResource(
    () => fn(untrack(prev)),
    v => v,
    options as any,
  )[0]

  const resultAccessor: AccessorWithLatest<T> = (() => resource()) as any
  Object.defineProperty(resultAccessor, 'latest', {
    get() {
      return (resource as any).latest
    },
  })

  return resultAccessor
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
    return createMemo<Next, Prev>((prev): Next => {
      if (untrack(() => this.map.get(key)?.count) === 0 && prev) {
        return prev as Next
      }
      return cb(prev as Prev)
    })
  }
}
