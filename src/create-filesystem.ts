import { createAsync, type AccessorWithLatest } from '@solidjs/router'
import { createMemo, createSignal, type Accessor, type Setter } from 'solid-js'
import { createStore, produce } from 'solid-js/store'

/**********************************************************************************/
/*                                                                                */
/*                                      Types                                     */
/*                                                                                */
/**********************************************************************************/

export type FileType = 'javascript' | 'css' | 'html' | 'unknown'
export interface File {
  type: FileType
  get: Accessor<string>
  set: Setter<string>
  transformed: AccessorWithLatest<string | undefined>
  cachedUrl: Accessor<string | undefined>
  createUrl: Accessor<string | undefined>
  invalidateUrl: () => void
}
export interface Dir {
  type: 'dir'
}
export type DirEnt = File | Dir
export type DirEntType = DirEnt['type']
export type Module = Record<string, unknown>
export type Extension = (path: string, source: string, fs: FileSystem) => File
export type FileSystem = ReturnType<typeof createFileSystem>

/**********************************************************************************/
/*                                                                                */
/*                                   Create File                                  */
/*                                                                                */
/**********************************************************************************/

export function createFile({
  type,
  initial,
  transform,
}: {
  type: File['type']
  initial: string
  transform?: (source: string) => string | Promise<string>
}): File {
  const [get, set] = createSignal<string>(initial)
  const [listen, emit] = createSignal<void>(null!, { equals: false })
  const transformed = createAsync(async () => (transform ? transform(get()) : get()))

  function createUrl() {
    const _transformed = transformed()
    if (!_transformed) return
    const blob = new Blob([_transformed], { type: `text/${type}` })
    return URL.createObjectURL(blob)
  }
  const cachedUrl = createMemo(() => (listen(), createUrl()))

  return {
    type,
    get,
    set,
    transformed,
    cachedUrl,
    createUrl,
    invalidateUrl: emit,
  }
}

/**********************************************************************************/
/*                                                                                */
/*                           Create Virtual File System                           */
/*                                                                                */
/**********************************************************************************/

export function createFileSystem(extensions: Record<string, Extension>) {
  const [dirEnts, setDirEnts] = createStore<Record<string, DirEnt>>({})

  function normalizePath(path: string) {
    return path.replace(/^\/+/, '')
  }

  function getExtension(path: string) {
    return path.split('/').slice(-1)[0]?.split('.')[1]
  }

  function getParentDirectory(path: string) {
    return path.split('/').slice(0, -1).join('/')
  }

  function assertPathExists(path: string) {
    const parts = path.split('/')
    const pathExists = parts
      .map((_, index) => parts.slice(0, index + 1).join('/'))
      .filter(Boolean)
      .every(path => path in dirEnts)

    if (!pathExists) {
      throw `Path is invalid ${path}`
    }
    return true
  }

  function getDirEnt(path: string) {
    path = normalizePath(path)

    const dirEnt = dirEnts[path]

    if (dirEnt?.type === 'dir') {
      throw `Path is not a file: ${dirEnt}`
    }

    return dirEnt
  }

  /** Get a cached object-url of the corresponding file. */
  function url(path: string) {
    return getDirEnt(path)?.cachedUrl()
  }
  /** Invalidate the cached object-url of the corresponding file. */
  url.invalidate = (path: string) => {
    return getDirEnt(path)?.invalidateUrl()
  }
  /** Create a new, uncached object-url from the corresponding file. */
  url.create = (path: string) => {
    return getDirEnt(path)?.createUrl()
  }

  function readdir(path: string, options?: { withFileTypes?: false }): Array<string>
  function readdir(
    path: string,
    options: { withFileTypes: true },
  ): Array<{ type: 'dir' | FileType; path: string }>
  function readdir(path: string, options?: { withFileTypes?: boolean }) {
    path = normalizePath(path)

    assertPathExists(path)

    if (options?.withFileTypes) {
      return Object.entries(dirEnts)
        .filter(([_path]) => getParentDirectory(_path) === path && path !== _path)
        .map(([path, file]) => ({
          type: file.type,
          path,
        }))
    }

    return Object.keys(dirEnts).filter(_path => getParentDirectory(_path) === path)
  }

  const fs = {
    url,
    transformed: (path: string) => getDirEnt(path)?.transformed(),
    getType(path: string): DirEnt['type'] {
      path = normalizePath(path)

      assertPathExists(path)

      return dirEnts[path]!.type
    },
    readdir,
    mkdir(path: string, options?: { recursive?: boolean }) {
      path = normalizePath(path)

      if (options?.recursive) {
        const parts = path.split('/')
        parts.forEach((_, index) => {
          setDirEnts(parts.slice(0, index + 1).join('/'), { type: 'dir' })
        })
        return
      }

      assertPathExists(getParentDirectory(path))

      setDirEnts(path, { type: 'dir' })
    },
    readFile(path: string) {
      path = normalizePath(path)

      const dirEnt = dirEnts[path]

      if (dirEnt?.type === 'dir') {
        throw `Path is not a file ${path}`
      }

      return dirEnt?.get()
    },
    rename(previous: string, next: string) {
      previous = normalizePath(previous)
      next = normalizePath(next)

      assertPathExists(previous)

      setDirEnts(
        produce(files => {
          Object.keys(dirEnts).forEach(path => {
            if (path.startsWith(previous)) {
              const newPath = path.replace(previous, next)
              files[newPath] = files[path]!
              delete files[path]
            }
          })
        }),
      )
    },
    rm(path: string, options?: { force?: boolean; recursive?: boolean }) {
      path = normalizePath(path)

      if (!options || !options.force) {
        assertPathExists(path)
      }

      if (!options || !options.recursive) {
        const _dirEnts = Object.keys(dirEnts).filter(value => {
          if (value === path) return false
          return value.includes(path)
        })

        if (_dirEnts.length > 0) {
          throw `Directory is not empty ${_dirEnts}`
        }
      }

      setDirEnts(
        produce(files => {
          Object.keys(files)
            .filter(value => value.includes(path))
            .forEach(path => delete files[path])
        }),
      )
    },
    writeFile(path: string, source: string) {
      path = normalizePath(path)
      assertPathExists(getParentDirectory(path))

      const dirEnt = dirEnts[path]!

      if (dirEnt?.type === 'dir') {
        throw `A directory already exist with the same name: ${path}`
      }

      const extension = getExtension(path)

      if (dirEnt) {
        dirEnt.set(source)
      } else {
        let dirEnt = extension && extensions[extension]?.(path, source, fs)
        dirEnt ||= createFile({
          type: 'unknown',
          initial: source,
          transform: () => new Promise<string>(() => {}),
        })
        setDirEnts(path, dirEnt)
      }
    },
  }

  return fs
}
