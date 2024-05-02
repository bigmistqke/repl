import { Accessor, Resource } from 'solid-js'

/**
 * Executes a callback with a value derived from an accessor if the value is truthy.
 *
 * @param accessor The value or function returning a value that is checked for truthiness.
 * @param callback The callback function to be executed if the accessor's value is truthy.
 * @returns The result of the callback if executed, otherwise undefined.
 */
export function when<
  const T,
  TAccessor extends Accessor<T> | T,
  const TValues extends TAccessor extends ((...args: any[]) => any) | undefined
    ? Exclude<ReturnType<Exclude<TAccessor, undefined>>, null | undefined | false>
    : Exclude<TAccessor, null | undefined | false>,
  TResult,
>(accessor: TAccessor, callback: (value: TValues) => TResult, fallback?: () => TResult) {
  const value = typeof accessor === 'function' ? accessor() : accessor
  return value ? callback(value) : fallback?.()
}

/**
 * Returns a function that conditionally executes a callback based on the truthiness of an accessor's value,
 * suitable for use in reactive programming contexts.
 * @param accessor The value or function returning a value that is checked for truthiness.
 * @param callback The callback function to be executed if the accessor's value is truthy.
 * @returns A function that can be called to execute the callback conditionally based on the accessor's value.
 */
export function whenever<
  const T,
  TAccessor extends Accessor<T> | T,
  const TValues extends TAccessor extends ((...args: any[]) => any) | undefined
    ? Exclude<ReturnType<Exclude<TAccessor, undefined>>, null | undefined | false>
    : Exclude<TAccessor, null | undefined | false>,
  TResult,
>(accessor: TAccessor, callback: (value: TValues) => TResult, fallback?: () => TResult) {
  return () => when(accessor, callback, fallback)
}

/**
 * Returns a function that conditionally executes and aggregates results from multiple accessors if all values are truthy.
 *
 * @param accessors Multiple accessors to be checked for truthiness.
 * @returns A function that can be called to conditionally execute based on the truthiness of all accessor values, returning their results as an array or undefined if any are not truthy.
 */
export function every<
  const T,
  TAccessors extends Array<Accessor<T> | T>,
  const TValues extends {
    [TKey in keyof TAccessors]: TAccessors[TKey] extends ((...args: any[]) => any) | undefined
      ? Exclude<ReturnType<Exclude<TAccessors[TKey], undefined>>, null | undefined | false>
      : Exclude<TAccessors[TKey], null | undefined | false>
  },
>(...accessors: TAccessors) {
  function callback(): TValues | undefined {
    const values = new Array(accessors.length)

    for (let i = 0; i < accessors.length; i++) {
      const _value = typeof accessors[i] === 'function' ? (accessors[i] as () => T)() : accessors[i]
      if (_value === undefined || _value === null || _value === false) return undefined
      values[i] = _value
    }

    return values as TValues
  }
  return callback
}

export function wrapNullableResource<T extends Resource<any>>(
  value: T,
): Accessor<false | [ReturnType<T>]> {
  return () => value.state === 'ready' && [value()]
}
