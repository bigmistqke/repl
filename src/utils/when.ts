import type { Accessor } from 'solid-js'
import type { AccessorMaybe } from '../types.ts'

type NonNullableValue<T> = Exclude<T, null | undefined | false | 0 | ''>

function resolve<T>(value: AccessorMaybe<T>): T {
  return typeof value === 'function' ? (value as Accessor<T>)() : value
}

/**
 * Returns a function that runs `callback` with the accessor's value when it is
 * truthy, or `fallback` (if given) when it is not. Inlined from
 * `@bigmistqke/solid-whenever`'s `when`, which this repo no longer depends on
 * (its bundle unconditionally imports `createComputed`, which Solid 2 removed).
 */
export function when<TValue, TArgs extends unknown[], TResult>(
  accessor: AccessorMaybe<TValue>,
  callback: (value: NonNullableValue<TValue>, ...args: TArgs) => TResult,
): (...args: TArgs) => TResult | undefined
export function when<TValue, TArgs extends unknown[], TResult, TFallbackResult>(
  accessor: AccessorMaybe<TValue>,
  callback: (value: NonNullableValue<TValue>, ...args: TArgs) => TResult,
  fallback: (...args: TArgs) => TFallbackResult,
): (...args: TArgs) => TResult | TFallbackResult
export function when(
  accessor: AccessorMaybe<unknown>,
  callback: (value: unknown, ...args: unknown[]) => unknown,
  fallback?: (...args: unknown[]) => unknown,
) {
  return (...args: unknown[]) => {
    const value = resolve(accessor)
    return value ? callback(value, ...args) : fallback?.(...args)
  }
}
