import { compressSync, decompressSync, strFromU8, strToU8 } from 'fflate'

/**********************************************************************************/
/*                                                                                */
/*                                 CONDITIONALS                                   */
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
  function callback(): TValues
  function callback<const TResult>(callback: (...values: TValues) => TResult): TResult
  function callback<const TResult>(callback?: (...values: TValues) => TResult) {
    const values = new Array(accessors.length)

    for (let i = 0; i < accessors.length; i++) {
      const _value = typeof accessors[i] === 'function' ? (accessors[i] as () => T)() : accessors[i]
      if (_value === undefined || _value === null || _value === false) return undefined
      values[i] = _value
    }

    if (!callback) return values

    return callback(...(values as any))
  }
  return callback
}

export function all<
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
/*                                       CURSOR                                   */
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
/*                                     COMPRESS                                   */
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
