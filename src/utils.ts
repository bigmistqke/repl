import { compressSync, decompressSync, strFromU8, strToU8 } from 'fflate'
import { Accessor } from 'solid-js'
import ts from 'typescript'

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
/*                                     Compres                                   */
/*                                                                                */
/**********************************************************************************/

// thanks tito
function base64ToBytes(base64: string) {
  return Uint8Array.from(atob(base64), m => m.codePointAt(0)!)
}

function bytesToBase64(bytes) {
  return btoa(String.fromCodePoint(...bytes))
}

export function compress(s: string) {
  return bytesToBase64(compressSync(strToU8(JSON.stringify(s))))
}
export function uncompress(s: string) {
  return JSON.parse(strFromU8(decompressSync(base64ToBytes(s))))
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

export const pathIsUrl = (value: string) =>
  value.startsWith('blob:') || value.startsWith('http:') || value.startsWith('https:')

export const pathIsRelativePath = (value: string) => value.startsWith('.')

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
          callback(node) // Apply the callback to modify the moduleSpecifier

          if (previous !== node.moduleSpecifier.text) {
            shouldPrint = true
            return ts.factory.updateImportDeclaration(
              node,
              node.modifiers,
              isImport ? node.importClause : node.exportClause,
              ts.factory.createStringLiteral(node.moduleSpecifier.text),
              node.assertClause, // Preserve the assert clause if it exists
            )
          }
        }
        return ts.visitEachChild(node, visit, context)
      }
      return node => ts.visitNode(node, visit)
    },
  ])
  if (!result.transformed[0]) return undefined
  if (!shouldPrint) return code
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })
  return printer.printFile(result.transformed[0])
}
