import { ReactiveMap } from '@solid-primitives/map'
import { ReactiveSet } from '@solid-primitives/set'
import {
  createComputed,
  createEffect,
  createMemo,
  createSignal,
  mapArray,
  onCleanup,
} from 'solid-js'
import type { Extension, FileUrls } from '../types.ts'
import { createAsync } from '../utils/create-async.ts'
import { getExtension } from '../utils/path.ts'
import { createFileUrl } from './create-file-url.ts'

/**
 * Creates a registry for managing object URLs derived from a set of reactive file sources.
 *
 * For each file, an object URL is automatically created and kept up-to-date whenever the file
 * content or its transformation changes.
 *
 * @param readFile -
 * @param extensions - A map of file extensions to their transformation behavior and MIME types.
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
 * const url = fileUrls.get('/src/index.js');
 * fileUrls.invalidate('/src/index.js'); // Forces a refresh
 */
export function createFileUrlSystem(
  readFile: (path: string) => string | Promise<string> | undefined,
  extensions: Record<string, Extension>,
): FileUrls {
  const actions = new ReactiveMap<
    string,
    { invalidate(): void; create(): string | undefined; get(): string | undefined }
  >()
  const paths = new ReactiveSet<string>()

  const api = {
    get(path: string, { cached = true }: { cached?: boolean } = { cached: true }) {
      paths.add(path)
      if (!cached) {
        return actions.get(path)?.create()
      }
      return actions.get(path)?.get()
    },
    invalidate(path: string) {
      return actions.get(path)?.invalidate()
    },
  }

  createComputed(
    mapArray(
      () => Array.from(paths.keys()),
      path => {
        const extension = getExtension(path)

        const [listen, invalidate] = createSignal<void>(null!, { equals: false })

        const source = createAsync(async () => {
          try {
            return await readFile(path)
          } catch {
            paths.delete(path)
            return undefined
          }
        })

        const transformedSource = createAsync(async () => {
          try {
            const _source = source()
            if (_source === undefined || _source === null) return undefined
            return (
              extensions[extension]?.transform?.({
                path,
                source: _source,
                fileUrls: api,
              }) || _source
            )
          } catch {
            return undefined
          }
        })

        const get = createMemo<string | undefined>(previous => {
          if (previous) URL.revokeObjectURL(previous)
          listen()
          return create()
        })

        function create() {
          const _transformed = transformedSource()
          if (!_transformed) return undefined
          return createFileUrl(_transformed, extensions[extension]?.type)
        }

        actions.set(path, {
          get,
          create,
          invalidate,
        })

        onCleanup(() => actions.delete(path))
      },
    ),
  )

  createEffect(() => console.log('paths', [...paths.keys()]))

  return api
}
