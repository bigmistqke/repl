import {
  createMemo,
  createEffect as createRenderEffect,
  createSignal,
  mapArray,
  onCleanup,
} from 'solid-js'
import { createStore } from 'solid-js/store'
import { getExtension } from './path.ts'
import type { Extension } from './types.ts'
import { createAsync } from './utils/create-async.ts'

export function createExecutables(
  fs: Record<string, string | null>,
  extensions: Record<string, Extension>,
) {
  const [actions, setActions] = createStore<
    Record<string, { invalidate(): void; create(): string | undefined; get(): string | undefined }>
  >({})

  const executables = {
    get(path: string) {
      return actions[path]?.get()
    },
    invalidate(path: string) {
      return actions[path]?.invalidate()
    },
    create(path: string) {
      return actions[path]?.create()
    },
  }

  createRenderEffect(
    mapArray(
      () => Object.keys(fs).filter(path => fs[path] !== null),
      path => {
        const extension = getExtension(path)

        const [listen, invalidateExecutable] = createSignal<void>(null!, { equals: false })

        const transformed = createAsync(
          async () =>
            extensions[extension]?.transform?.({ path, source: fs[path]!, executables }) ||
            fs[path]!,
        )

        function createExecutable() {
          const _transformed = transformed()
          if (!_transformed) return
          const blob = new Blob([_transformed], {
            type: `text/${extensions[extension]?.type || 'plain'}`,
          })
          return URL.createObjectURL(blob)
        }

        const getExecutable = createMemo<string | undefined>(previous => {
          if (previous) URL.revokeObjectURL(previous)
          listen()
          return createExecutable()
        })

        setActions({
          [path]: {
            get: getExecutable,
            create: createExecutable,
            invalidate: invalidateExecutable,
          },
        })
        onCleanup(() => setActions({ [path]: undefined }))
      },
    ),
  )

  return executables
}
