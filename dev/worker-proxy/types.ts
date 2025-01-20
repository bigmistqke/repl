export type $Transfer<T = Array<any>, U = Array<Transferable>> = [T, U] & { $transfer: true }
export type $Callback<T extends Array<any>> = ((...args: T) => void) & { $callback: true }

export type Fn = (...arg: Array<any>) => any

export type SyncMethods<T extends Record<string, Fn>> = {
  [TKey in keyof T]: (...args: Parameters<T[TKey]> | [$Transfer<Parameters<T[TKey]>>]) => void
}

export type AsyncMethods<T extends Record<string, Fn>> = {
  [TKey in keyof T]: (
    ...args: Parameters<T[TKey]> | [$Transfer<Parameters<T[TKey]>>]
  ) => Promise<ReturnType<T[TKey]>>
}

export type WorkerProps<T extends Record<string, Fn>> = SyncMethods<T> & {
  $async: AsyncMethods<T>
}

export type WorkerProxy<T> = T extends (args: infer Props) => infer Methods
  ? Methods extends Record<string, Fn>
    ? SyncMethods<Methods> & {
        $async: AsyncMethods<Methods>
        $on: {
          [TKey in keyof Props]: (data: Props[TKey]) => () => void
        }
      }
    : never
  : T extends Record<string, Fn>
  ? SyncMethods<T> & {
      $async: AsyncMethods<T>
    }
  : never

/** Branded `MessagePort` */
export type WorkerProxyPort<T> = MessagePort & { $: T }
