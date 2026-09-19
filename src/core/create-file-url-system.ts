import { when } from '@bigmistqke/solid-whenever'
import { type Accessor, createEffect, createMemo, createSignal, latest, onCleanup } from 'solid-js'
import type { Extension, FileUrlSystem } from '../types.ts'
import * as PathUtils from '../utils/path-utils.ts'
import { accessMaybe, ReactiveRefCount } from '../utils/utils.ts'
import { createFileUrl } from './create-file-url.ts'

interface FileUrlApi {
  get(): string | undefined
  create(): string | undefined
  invalidate(): void
}

/**
 * Creates a registry for managing object URLs derived from a set of reactive file sources.
 *
 * For each file, an object URL is automatically created and kept up-to-date whenever the file
 * content or its transformation changes.
 *
 * @param readFile A function that reads file content by path, returning string, Promise<string>, or undefined.
 * @param extensions - A map of file extensions to their transformation behavior and MIME types.
 *
 * `get`/`create` read the file source directly: if it is still pending (a
 * `Promise`) or errored, reading it suspends/throws like any other async
 * Solid 2 computation — call them under a `<Loading>`/`<Errored>` boundary,
 * or wrap the call in `latest()` if you want a non-suspending `| undefined`
 * peek instead, e.g. `latest(() => fileUrls.get(path))`.
 *
 * @returns An API with the following methods:
 * - `get(path: string): string | undefined` — Returns the current managed object URL for the given path.
 *   The URL is automatically revoked and recreated when the file or its transformation changes.
 * - `create(path: string): string | undefined` — Manually creates a new object URL for the given path.
 *   The caller is responsible for revoking any URLs created with this method.
 * - `invalidate(path: string): void` — Forces `get(path)` to re-run and refresh its cached object URL.
 *
 * @example
 * const fileUrls = createFileUrlSystem(files, extensions);
 * const url = latest(() => fileUrls.get('/src/index.js'));
 * fileUrls.invalidate('/src/index.js'); // Forces a refresh
 */
export function createFileUrlSystem({
  readFile,
  extensions,
}: {
  readFile: (path: string) => string | Promise<string> | undefined
  extensions: Record<string, Extension>
}): FileUrlSystem {
  const refCount = new ReactiveRefCount((path): Accessor<FileUrlApi | undefined> => {
    // Just a computation that may return a Promise or throw — Solid's async
    // model (Loading/Errored boundaries, `latest`) handles pending/error state.
    // We do not collapse those into a sentinel here.
    const source = createMemo(() => readFile(path))
    const extension = PathUtils.getExtension(path)

    createEffect(
      // `latest` is used here only to peek at bookkeeping state without
      // suspending/throwing — it never leaks into the public get()/create() API.
      () => refCount.isNull(path) && latest(source) === undefined,
      shouldDelete => {
        // Only remove reference if
        // - nothing is referencing path and
        // - source does not exist
        if (shouldDelete) {
          refCount.delete(path)
        }
      },
    )

    return createMemo(
      when(source, () => {
        const [listen, invalidate] = createSignal<void>(null!, { equals: false })

        const transformer = createMemo(
          when(source, source => {
            if (source && extensions[extension]?.transform) {
              return extensions[extension].transform({
                path,
                source,
                fileUrls: api,
              })
            }
            return source
          }),
        )

        const transformedSource = createMemo(() => accessMaybe(transformer()))

        const create = when(transformedSource, transformed => {
          return createFileUrl(transformed, extensions[extension]?.type)
        })

        const get = createMemo(() => {
          listen()
          const url = create()
          if (url) {
            onCleanup(() => URL.revokeObjectURL(url))
          }
          return url
        })

        return {
          get,
          create,
          invalidate,
        }
      }),
    )
  })

  const api: FileUrlSystem = {
    get(path, { cached = true } = { cached: true }) {
      const action = refCount.track(path)()
      if (!cached) {
        return action?.create()
      }
      return action?.get()
    },
    invalidate(path) {
      return refCount.get(path)?.()?.invalidate()
    },
  }

  return api
}
