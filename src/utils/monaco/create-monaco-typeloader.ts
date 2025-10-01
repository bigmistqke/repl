import type * as Monaco from 'monaco-editor'
import { createEffect, createSignal } from 'solid-js'
import { createStore } from 'solid-js/store'
import type TS from 'typescript'
import { downloadTypesfromPackageName } from '../download-types.ts'
import { mapObject } from '../utils.ts'

/**
 * Creates a manager for downloading and tracking TypeScript declaration files (`.d.ts`)
 * for use with Monaco Editor, based on a given `tsconfig`.
 *
 * This utility supports dynamically adding downloaded types, aliasing module names,
 * and reactively watching for changes to the types and tsconfig.
 *
 * @param tsconfig - The initial TypeScript compiler options to extend and reactively update.
 *
 * @returns An API with the following methods:
 *
 * ### Configuration and State
 * - `tsconfig()` — Returns the current `tsconfig` including added paths for downloaded modules.
 * - `types()` — Returns the current record of downloaded declaration file contents.
 *
 * ### Modifications
 * - `addDeclaration(path, source, alias?)` — Adds a new declaration manually, optionally aliasing it to a module name.
 * - `downloadModule(name)` — Downloads types for the specified npm package and adds them automatically.
 *
 * ### Watchers
 * - `watchTsconfig(cb)` — Registers a callback to be called whenever the `tsconfig` changes.
 * - `watchTypes(cb)` — Registers a callback to be called whenever the types change.
 *
 * @example
 * const downloader = createMonacoTypeDownloader({
 *   target: monaco.languages.typescript.ScriptTarget.ESNext,
 *   moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
 * });
 *
 * downloader.downloadModule('lodash');
 * downloader.watchTypes(types => {
 *   console.log('Updated types:', types);
 * });
 */
export function createMonacoTypeDownloader({
  ts,
  tsconfig,
}: {
  ts: typeof TS
  tsconfig: Monaco.languages.typescript.CompilerOptions
}) {
  const [types, setTypes] = createStore<Record<string, string>>({})
  const [aliases, setAliases] = createSignal<Record<string, Array<string>>>({})

  function addAlias(alias: string, path: string) {
    setAliases(paths => {
      paths[alias] = [`file:///${path}`]
      return { ...paths }
    })
  }

  const methods = {
    tsconfig() {
      return {
        ...tsconfig,
        paths: {
          ...mapObject(tsconfig.paths || {}, value => value.map(path => `file:///${path}`)),
          ...aliases(),
        },
      }
    },
    types() {
      return types
    },
    addDeclaration(path: string, source: string, alias?: string) {
      setTypes(path, source)
      if (alias) {
        addAlias(alias, path)
      }
    },
    async downloadModule(name: string) {
      if (!(name in aliases())) {
        const { types, path } = await downloadTypesfromPackageName({ name, ts })
        setTypes(types)
        addAlias(name, path)
      }
    },
    // Watchers
    watchTsconfig(cb: (tsconfig: Monaco.languages.typescript.CompilerOptions) => void) {
      createEffect(() => cb(methods.tsconfig()))
    },
    watchTypes(cb: (types: Record<string, string>) => void) {
      createEffect(() => cb({ ...types }))
    },
  }

  return methods
}
