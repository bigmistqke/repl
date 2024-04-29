import { Accessor } from 'solid-js'
import ts, { SourceFile } from 'typescript'

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

export const pathIsUrl = (value: string) =>
  value.startsWith('blob:') || value.startsWith('http:') || value.startsWith('https:')

export const pathIsRelativePath = (value: string) => value.startsWith('.')

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

/**********************************************************************************/
/*                                                                                */
/*                             Map Module Declarations                            */
/*                                                                                */
/**********************************************************************************/

export function mapModuleDeclarations(
  path: string,
  code: string,
  callback: (node: ts.ImportDeclaration | ts.ExportDeclaration) => void,
) {
  const sourceFile = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  let shouldPrint = false
  const result = ts.transform(sourceFile, [
    context => {
      const visit: ts.Visitor = node => {
        if (
          (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
          node.moduleSpecifier &&
          ts.isStringLiteral(node.moduleSpecifier)
        ) {
          const isImport = ts.isImportDeclaration(node)

          const previous = node.moduleSpecifier.text

          try {
            callback(node) // Apply the callback to modify the moduleSpecifier
          } catch {
            shouldPrint = true
            return
          }

          if (previous !== node.moduleSpecifier.text) {
            shouldPrint = true
            if (isImport) {
              return ts.factory.updateImportDeclaration(
                node,
                node.modifiers,
                node.importClause,
                ts.factory.createStringLiteral(node.moduleSpecifier.text),
                node.assertClause, // Preserve the assert clause if it exists
              )
            } else {
              return ts.factory.updateExportDeclaration(
                node,
                node.modifiers,
                false,
                node.exportClause,
                ts.factory.createStringLiteral(node.moduleSpecifier.text),
                node.assertClause, // Preserve the assert clause if it exists
              )
            }
          }
        }
        return ts.visitEachChild(node, visit, context)
      }
      return node => ts.visitNode(node, visit) as SourceFile
    },
  ])
  if (!result.transformed[0]) return undefined
  if (!shouldPrint) return code
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })
  return printer.printFile(result.transformed[0])
}
