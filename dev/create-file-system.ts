import { createStore } from 'solid-js'

/** Minimal reactive path -> source store, just enough for the dev playground. */
export function createFileSystem() {
  const [store, setStore] = createStore<Record<string, string>>({})

  return {
    readFile(path: string) {
      return store[path]
    },
    writeFile(path: string, source: string) {
      setStore(draft => {
        draft[path] = source
      })
    },
  }
}
