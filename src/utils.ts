import { Accessor, Resource, onCleanup } from 'solid-js'

const concatTemplate = (template: TemplateStringsArray, values: string[]) =>
  template.reduce((acc, str, i) => acc + str + (values[i] || ''), '')

/**
 * Creates a URL for a dynamically generated HTML blob from a template literal.
 * This function combines template strings and values to form an HTML content,
 * converts it to a Blob, and then creates an object URL for it.
 * It automatically revokes the ObjectURL on cleanup.
 *
 * @param {TemplateStringsArray} template - The template strings array, containing the static parts of the template.
 * @param {...string} values - The dynamic values to be interpolated into the template.
 * @returns {string} The URL of the created HTML blob, which can be used in contexts such as iframes or as a link href.
 * @example
 * const userContent = "<p>Hello, ${username}</p>";
 * const safeUrl = html`<div>${userContent}</div>`;
 * iframe.src = safeUrl;
 */
export function html(template: TemplateStringsArray, ...values: string[]) {
  const url = URL.createObjectURL(
    new Blob([concatTemplate(template, values)], { type: 'text/html' }),
  )
  onCleanup(() => URL.revokeObjectURL(url))
  return url
}

/**
 * Creates a URL for a dynamically generated ESM blob from a template literal.
 * Similar to the `html` function, it uses a tagged template to construct JavaScript content,
 * encapsulates it in a Blob, and then creates an object URL for the Blob.
 * It automatically revokes the ObjectURL on cleanup.
 *
 * @param template - The template strings array, part of the tagged template literal.
 * @param values - The interpolated values that will be included in the JavaScript code.
 * @returns  The URL of the created JavaScript blob, which can be used to dynamically load scripts.
 * @example
 
 * const scriptUrl = js`console.log('Hello, ${username}');`;
 * someElement.src = scriptUrl;
 */
export function javascript(template: TemplateStringsArray, ...values: string[]) {
  const url = URL.createObjectURL(
    new Blob([concatTemplate(template, values)], { type: 'text/javascript' }),
  )
  onCleanup(() => URL.revokeObjectURL(url))
  return url
}

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
  TAccessor extends Accessor<T> | T,
  const TValues extends TAccessor extends ((...args: any[]) => any) | undefined
    ? Exclude<ReturnType<Exclude<TAccessor, undefined>>, null | undefined | false>
    : Exclude<TAccessor, null | undefined | false>,
  TResult,
>(accessor: TAccessor, callback: (value: TValues) => TResult) {
  const value = typeof accessor === 'function' ? accessor() : accessor
  return value ? callback(value) : undefined
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

export function wrapNullableResource<T extends Resource<any>>(
  value: T,
): Accessor<false | [ReturnType<T>]> {
  return () => value.state === 'ready' && [value()]
}

/**********************************************************************************/
/*                                                                                */
/*                                       Cursor                                   */
/*                                                                                */
/**********************************************************************************/

type Delta = {
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
  callback: (delta: Delta, event: MouseEvent, timespan: number) => void,
) => {
  return new Promise<{ delta: Delta; event: MouseEvent; timespan: number }>(resolve => {
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
