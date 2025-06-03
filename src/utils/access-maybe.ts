import { Accessor } from 'solid-js'

export function accessMaybe<T>(maybeAccessor: Accessor<T> | T): T {
  if (typeof maybeAccessor === 'function') {
    return maybeAccessor()
  }
  return maybeAccessor
}
