import { createEffect, createMemo, createSignal, mapArray } from 'solid-js'
import { createStore, produce } from 'solid-js/store'
import { createExecutables } from './create-executables.ts'
import { getExtension, normalizePath } from './path.ts'
import { Extension, FileType, Match } from './types.ts'

/**********************************************************************************/
/*                                                                                */
/*                           Create Virtual File System                           */
/*                                                                                */
/**********************************************************************************/

export type FileSystem = ReturnType<typeof createFileSystem>

function getParentDirectory(path: string) {
  return path.split('/').slice(0, -1).join('/')
}

function globToRegex(glob: string) {
  const regex = glob
    .replace(/\*\*/g, '.*') // Match `**`
    .replace(/\*/g, '[^/]*') // Match `*`
    .replace(/\?/g, '.') // Match `?`
  return new RegExp(`^${regex}$`)
}

export function createFileSystem(extensions: Record<string, Extension>) {
  const [fs, setFs] = createStore<Record<string, string | null>>({})
  const executables = createExecutables(() => fs, extensions)

  const [match, setMatch] = createSignal<Match>((glob: string) => {
    const regex = globToRegex(glob)
    return (paths: Array<string>) => paths.filter(path => regex.test(path))
  })

  function createGlobEffect(glob: string, cb: (path: string) => void) {
    const matchFn = createMemo(() => match()(glob))
    createEffect(
      mapArray(
        () => matchFn()(api.getPaths()),
        path => createEffect(() => cb(path)),
      ),
    )
  }

  function assertPathExists(path: string) {
    const parts = path.split('/')
    const pathExists = parts
      .map((_, index) => parts.slice(0, index + 1).join('/'))
      .filter(Boolean)
      .every(path => path in fs)

    if (!pathExists) {
      throw `Path is invalid ${path}`
    }
    return true
  }
  function assertNotDir(path: string) {
    if (fs[path] === null) {
      throw `Path is not a file: ${path}`
    }
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
      return Object.entries(fs)
        .filter(([_path]) => getParentDirectory(_path) === path && path !== _path)
        .map(([path, file]) => ({
          type: file === null ? 'dir' : extensions[getExtension(path)]?.type || 'plain',
          path,
        }))
    }

    return Object.keys(fs).filter(_path => getParentDirectory(_path) === path)
  }

  const api = {
    executables,
    getPaths: () => Object.keys(fs),
    getType(path: string): FileType | 'dir' {
      path = normalizePath(path)

      assertPathExists(path)

      return fs[path] === null ? 'dir' : extensions[getExtension(path)]?.type || 'plain'
    },
    readdir,
    mkdir(path: string, options?: { recursive?: boolean }) {
      path = normalizePath(path)

      if (options?.recursive) {
        const parts = path.split('/')
        parts.forEach((_, index) => {
          setFs(parts.slice(0, index + 1).join('/'), null)
        })
        return
      }

      assertPathExists(getParentDirectory(path))

      setFs(path, null)
    },
    readFile(path: string) {
      path = normalizePath(path)

      const file = fs[path]

      if (file === null) {
        throw `Path is not a file ${path}`
      }

      return file
    },
    rename(previous: string, next: string) {
      previous = normalizePath(previous)
      next = normalizePath(next)

      assertPathExists(previous)

      setFs(
        produce(files => {
          Object.keys(fs).forEach(path => {
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
        const _dirEnts = Object.keys(executables).filter(value => {
          if (value === path) return false
          return value.includes(path)
        })

        if (_dirEnts.length > 0) {
          throw `Directory is not empty ${_dirEnts}`
        }
      }

      setFs(
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

      if (fs[path] === null) {
        throw `A directory already exist with the same name: ${path}`
      }

      setFs(path, source)
    },
    // Watchers
    watchExecutable(glob: string, cb: (url: string | undefined, path: string) => void) {
      createGlobEffect(glob, path => cb(api.executables.get(path), path))
    },
    watchFile(glob: string, cb: (source: string | undefined, path: string) => void) {
      createGlobEffect(glob, path => cb(api.readFile(path), path))
    },
    watchDir(
      path: string,
      cb: (paths: Array<{ type: FileType | 'dir'; path: string }>, path: string) => void,
    ) {
      cb(api.readdir(path, { withFileTypes: true }), path)
    },
    watchPaths(cb: (paths: Array<string>) => void) {
      createEffect(() => cb(api.getPaths()))
    },
    // Set match function
    setMatch: setMatch,
  }

  return api
}
