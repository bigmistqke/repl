export * from './types.js'
import type { $Transfer, Fn, WorkerProxy, WorkerProxyPort } from './types.js'

type Callback<T = Fn> = T & { [$CALLBACK]: number }

const $CALLBACK = '$WORKER_PROXY_CALLBACK'
let CALLBACK_ID = 0
const CALLBACK_MAP = new Map<number, Callback>()

function createProxy<T extends object = object>(callback: (property: string | symbol) => void) {
  return new Proxy({} as T, {
    get(_, property) {
      return callback(property)
    },
  })
}

function isTransfer(value: any): value is $Transfer {
  return value && typeof value === 'object' && '$transfer' in value && value.$transfer
}

/**
 * Wraps a worker in a WorkerProxy.
 *
 * Accepts either a
 * - `Worker`
 * - `string`: _will create a worker from given url_
 * - `WorkerProxyPort`: _a MessagePort created by `workerProxy.$port()`_
 *
 * When given a `Worker | string` you can type the proxy with a generic.
 * When given a `WorkerProxyPort` it will infer the types
 * from the `WorkerProxy` that created the port.
 *
 * @example
 *
 * ```tsx
 * import { createWorkerProxy } from "@bigmistqke/worker-proxy"
 * import type Methods from "./worker.ts"
 *
 * const workerProxy = createWorkerProxy<typeof Methods>(new Worker('./worker.ts'))
 * const port = workerProxy.$port()
 *
 * // type automatically inferred.
 * const otherProxy = createWorkerProxy(port)
 * ```
 */
export function createWorkerProxy<T extends WorkerProxyPort<any>>(input: T): WorkerProxy<T['$']>
export function createWorkerProxy<T>(input: string | Worker): WorkerProxy<T>
export function createWorkerProxy(input: WorkerProxyPort<any> | Worker | string) {
  const worker = typeof input === 'string' ? new Worker(input) : input

  let id = 0
  const pendingMessages: Record<
    string,
    { resolve: (value: unknown) => void; reject: (value: unknown) => void }
  > = {}
  const eventTarget = new EventTarget()

  function postMessage(topic: string | symbol, data: $Transfer | Array<any>, id?: number) {
    if (isTransfer(data[0])) {
      const [_data, transferables] = data[0]
      worker.postMessage(
        {
          topic,
          data: _data,
          id,
        },
        transferables,
      )
    } else {
      worker.postMessage({
        topic,
        data,
        id,
      })
    }
  }

  const asyncProxy = createProxy(topic => {
    return (...data: Array<unknown>) => {
      id++
      postMessage(topic, data, id)
      return new Promise((resolve, reject) => {
        pendingMessages[id] = { resolve, reject }
      })
    }
  })

  worker.onmessage = ({ data: { topic, data, id, error, callback, args } }) => {
    if (callback || args) {
      CALLBACK_MAP.get(callback)?.(...args)
      return
    }
    if (pendingMessages[id]) {
      if (error) {
        pendingMessages[id].reject(error)
      } else {
        pendingMessages[id].resolve(data)
      }
      delete pendingMessages[id]
      return
    }
    eventTarget.dispatchEvent(new CustomEvent(topic, { detail: data }))
  }

  return createProxy(topic => {
    switch (topic) {
      case '$port':
        return () => {
          const { port1, port2 } = new MessageChannel()
          worker.postMessage({ port: port1 }, [port1])
          return port2
        }
      case '$async':
        return asyncProxy
      case '$on':
        return createProxy(property => {
          return (callback: (...data: Array<unknown>) => void) => {
            const abortController = new AbortController()
            eventTarget.addEventListener(
              property as string,
              event => callback(...(event as Event & { detail: Array<unknown> }).detail),
              {
                signal: abortController.signal,
              },
            )
            return () => abortController.abort()
          }
        })
      default:
        return (...args: Array<any>) => {
          for (let i = 0; i < args.length; i++) {
            const arg = args[i]
            if (typeof arg === 'function') {
              if (!($CALLBACK in arg)) {
                CALLBACK_ID++
                CALLBACK_MAP.set(CALLBACK_ID, arg)
                arg[$CALLBACK] = CALLBACK_ID
              }
              args[i] = {
                [$CALLBACK]: arg[$CALLBACK],
              }
            }
          }
          return postMessage(topic, args)
        }
    }
  })
}

/**
 * Prepare worker for commands of `WorkerProxy` by registering its methods.
 *
 * Accepts either
 * - An object of methods
 * - A callback that
 *     - Accepts an object of methods
 *         - When called these call back to the main thread
 *         - These can be subscribed to with `workerProxy.$on.method`
 *     - Returns an object of methods
 *
 * Returns the input, for ease of typing:
 *
 * @example
 *
 * ```tsx
 * // worker.ts
 * import { registerMethods } from '@bigmistqke/worker-proxy'
 *
 * export default registerMethods({ hallo: () => console.log('hallo') })
 *
 * // main.ts
 * import { createWorkerProxy } from '@bigmistqke/worker-proxy'
 * import type Methods from './worker.ts'
 *
 * const workerProxy = createWorkerProxy<typeof Methods>(new Worker('./worker.ts'))
 * workerProxy.hallo()
 * ```
 */
export function registerMethods<T extends Record<string, Fn> | ((args: any) => Record<string, Fn>)>(
  getMethods: T,
) {
  const api: Record<string, Fn> =
    typeof getMethods === 'function'
      ? getMethods(
          createProxy(
            topic =>
              (...data: Array<unknown>) =>
                postMessage(topic as string, data),
          ),
        )
      : getMethods

  function postMessage(topic: string, data: Array<unknown>, id?: number) {
    if (isTransfer(data[0])) {
      self.postMessage({ topic, data: data[0][0], id }, '/', data[0][1])
    } else {
      self.postMessage({ topic, data, id })
    }
  }
  async function onMessage({ data: { topic, data, port, id } }: any) {
    if (port) {
      port.onmessage = onMessage
      return
    }

    for (let i = 0; i < data.length; i++) {
      const arg = data[i]
      if (typeof arg === 'object' && $CALLBACK in arg) {
        data[i] = (...args: Array<any>) => {
          self.postMessage({ callback: arg[$CALLBACK], args })
        }
      }
    }

    if (id !== undefined) {
      try {
        const result = await api[topic](...data)
        postMessage(topic, result, id)
      } catch (error) {
        self.postMessage({ id, error })
      }
      return
    }

    api[topic](...data)
  }

  self.onmessage = onMessage

  // Return the argument for typing purposes
  return getMethods
}

/**
 * Utility function to accomodate for `Transferables`
 *
 * @example
 *
 * ```tsx
 * const buffer = new ArrayBuffer()
 *
 * // This will clone the buffer
 * workerProxy.sendBuffer(ab)
 *
 * // This will transfer the buffer without cloning
 * workerProxy.sendBuffer($transfer(ab, [ab]))
 * ```
 *
 * @example
 *
 * Also works when returning a value from a
 *
 * ```tsx
 * // main.ts
 * workerProxy.$async.getBuffer().then(console.log)
 *
 * // worker.ts
 * const buffer = new ArrayBuffer()
 *
 * const methods = {
 *   getBuffer(){
 *     return $transfer(ab, [ab])
 *   }
 * }
 * ```
 */
export function $transfer<const T extends Array<any>, const U extends Array<Transferable>>(
  ...args: [...T, U]
) {
  const transferables = args.pop()
  const result = [args, transferables] as unknown as $Transfer<T, U>
  result.$transfer = true
  return result
}

export function $dispose(callback: ((...args: Array<any>) => void) & { [$CALLBACK]?: number }) {
  const id = $CALLBACK in callback ? callback[$CALLBACK] : undefined
  if (id !== undefined) {
    CALLBACK_MAP.delete(id)
  }
}
