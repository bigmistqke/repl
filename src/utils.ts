import { Accessor } from 'solid-js'

/**********************************************************************************/
/*                                                                                */
/*                                       Log                                      */
/*                                                                                */
/**********************************************************************************/

export const createLog =
  (name: string, on: boolean) =>
  (...args: any[]) =>
    on && console.log(name, ...args)

/**********************************************************************************/
/*                                                                                */
/*                                   Deep Merge                                   */
/*                                                                                */
/**********************************************************************************/

export function deepMerge<TTarget extends Record<string, any>, TSource extends Record<string, any>>(
  target: TTarget,
  source: TSource,
) {
  const output: Record<string, any> = Array.isArray(source) ? [] : {}

  for (const key in target) {
    if (target.hasOwnProperty(key)) {
      output[key] = target[key]
    }
  }

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !((source[key] as Record<string, any>) instanceof Date) &&
        !((source[key] as Record<string, any>) instanceof Function)
      ) {
        output[key] = target[key] ? deepMerge(target[key], source[key]) : source[key]
      } else {
        // Preserve getters by defining them as properties
        const descriptor = Object.getOwnPropertyDescriptor(source, key)
        if (descriptor && typeof descriptor.get === 'function') {
          Object.defineProperty(output, key, descriptor)
        } else {
          output[key] = source[key]
        }
      }
    }
  }
  return output as TTarget & TSource
}

/**********************************************************************************/
/*                                                                                */
/*                                   Type Utils                                   */
/*                                                                                */
/**********************************************************************************/

export type Mandatory<TTarget, TKeys extends keyof TTarget> = Required<Pick<TTarget, TKeys>> &
  Omit<TTarget, TKeys>

/**********************************************************************************/
/*                                                                                */
/*                                 Conditionals                                   */
/*                                                                                */
/**********************************************************************************/

export function when<
  const T,
  TAccessors extends Array<Accessor<T> | T>,
  const TValues extends {
    [TKey in keyof TAccessors]: TAccessors[TKey] extends ((...args: any[]) => any) | undefined
      ? Exclude<ReturnType<Exclude<TAccessors[TKey], undefined>>, null | undefined | false>
      : Exclude<TAccessors[TKey], null | undefined | false>
  },
>(...accessors: TAccessors) {
  // function callback(): TValues
  // function callback<const TResult>(callback: (...values: TValues) => TResult): TResult
  function callback<const TResult>(callback: (...values: TValues) => TResult) {
    const values = new Array(accessors.length)

    for (let i = 0; i < accessors.length; i++) {
      const _value = typeof accessors[i] === 'function' ? (accessors[i] as () => T)() : accessors[i]
      if (_value === undefined || _value === null || _value === false) return undefined
      values[i] = _value
    }

    // if (!callback) return values

    return callback(...(values as any))
  }
  return callback
}

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

/**********************************************************************************/
/*                                                                                */
/*                                       Cursor                                   */
/*                                                                                */
/**********************************************************************************/

export type Vector = {
  x: number
  y: number
}

/**
 * cursor
 *
 * @param e MouseEvent
 * @param callback called every onMouseMove
 * @returns Promise resolved onMouseUp
 */
export const cursor = (
  e: MouseEvent,
  callback: (delta: Vector, event: MouseEvent, timespan: number) => void,
) => {
  return new Promise<{ delta: Vector; event: MouseEvent; timespan: number }>(resolve => {
    const start = {
      x: e.clientX,
      y: e.clientY,
    }
    const startTime = performance.now()

    const onMouseMove = (e: MouseEvent) => {
      callback(
        {
          x: start.x - e.clientX,
          y: start.y - e.clientY,
        },
        e,
        performance.now() - startTime,
      )
    }
    const onMouseUp = (e: MouseEvent) => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      const delta = {
        x: start.x - e.clientX,
        y: start.y - e.clientY,
      }
      callback(delta, e, performance.now() - startTime)
      resolve({ delta, event: e, timespan: performance.now() - startTime })
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  })
}

export const waitFor = (time = 1000) => new Promise(resolve => setTimeout(resolve, time))

/**********************************************************************************/
/*                                                                                */
/*                                       Path                                     */
/*                                                                                */
/**********************************************************************************/

export function relativeToAbsolutePath(currentPath: string, relativePath: string) {
  const ancestorCount = relativePath.match(/\.\.\//g)?.length || 0

  const newPath =
    ancestorCount > 0
      ? [
          ...currentPath.split('/').slice(0, -(ancestorCount + 1)),
          ...relativePath.split('/').slice(ancestorCount),
        ]
      : [...currentPath.split('/').slice(0, -1), ...relativePath.split('/').slice(1)]

  return newPath.join('/')
}

export const isUrl = (value: string) =>
  value.startsWith('blob:') || value.startsWith('http:') || value.startsWith('https:')

export const isRelativePath = (value: string) => value.startsWith('.')

// Regex to capture package names including those with or without '@' in the beginning and versions
const regex = /(?:@?[^@\/]*\/)?([^@\/]+)@([^\s\/]+)/
export const pathToPackageNameAndVersion = (path: string) => {
  const match = path.match(regex)
  if (match) {
    const packageName = match[1] // captures the package name, adjusting for optional '@' in the beginning
    const version = match[2] // captures the version
    return [packageName, version] as [string, string]
  } else {
    return undefined
  }
}
