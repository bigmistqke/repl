// interpolated from https://raw.githubusercontent.com/solidjs/solid-router/50c5d7bdef6acc5910c6eb35ba6a24b15aae3ef6/src/data/createAsync.ts

import { createResource, untrack } from 'solid-js'

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
  fn: (prev: T) => Promise<T>,
  options: {
    name?: string
    initialValue: T
    deferStream?: boolean
  },
): AccessorWithLatest<T>
export function createAsync<T>(
  fn: (prev: T | undefined) => Promise<T>,
  options?: {
    name?: string
    initialValue?: T
    deferStream?: boolean
  },
): AccessorWithLatest<T | undefined>
export function createAsync<T>(
  fn: (prev: T | undefined) => Promise<T>,
  options?: {
    name?: string
    initialValue?: T
    deferStream?: boolean
  },
): AccessorWithLatest<T | undefined> {
  let resource: () => T
  let prev = () =>
    !resource || (resource as any).state === 'unresolved' ? undefined : (resource as any).latest
  ;[resource] = createResource(
    () => fn(untrack(prev)),
    v => v,
    options as any,
  )

  const resultAccessor: AccessorWithLatest<T> = (() => resource()) as any
  Object.defineProperty(resultAccessor, 'latest', {
    get() {
      return (resource as any).latest
    },
  })

  return resultAccessor
}
