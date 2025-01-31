import type * as Monaco from 'monaco-editor'
import { createEffect, createSignal, mapArray, mergeProps, onCleanup } from 'solid-js'
import { createStore } from 'solid-js/store'
import { FileSystem } from './create-filesystem.ts'
import { downloadTypesfromPackage } from './download-types.ts'
import { getExtension } from './path.ts'
import { mapObject } from './utils/map-object.ts'

export function createMonacoTypeDownloader(tsconfig: Monaco.languages.typescript.CompilerOptions) {
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
        const { types, path } = await downloadTypesfromPackage({ name })
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

export function bindMonaco(props: {
  editor: Monaco.editor.IStandaloneCodeEditor
  fs: FileSystem
  languages?: Record<string, string>
  monaco: typeof Monaco
  path: string
  tsconfig?: Monaco.languages.typescript.CompilerOptions
  types?: Record<string, string>
}) {
  const languages = mergeProps(
    {
      tsx: 'typescript',
      ts: 'typescript',
    },
    () => props.languages,
  )

  function getType(path: string) {
    let type: string = props.fs.getType(path)
    const extension = getExtension(path)
    if (extension && extension in languages) {
      type = languages[extension]!
    }
    return type
  }

  createEffect(() => {
    props.editor.onDidChangeModelContent(() => {
      props.fs.writeFile(props.path, props.editor.getModel()!.getValue())
    })
  })

  createEffect(
    mapArray(props.fs.getPaths, path => {
      createEffect(() => {
        const type = getType(path)
        if (type === 'dir') return
        const uri = props.monaco.Uri.parse(`file:///${path}`)
        const model =
          props.monaco.editor.getModel(uri) || props.monaco.editor.createModel('', type, uri)
        createEffect(() => {
          const value = props.fs.readFile(path) || ''
          if (value !== model.getValue()) {
            model.setValue(props.fs.readFile(path) || '')
          }
        })
        onCleanup(() => model.dispose())
      })
    }),
  )

  createEffect(() => {
    const uri = props.monaco.Uri.parse(`file:///${props.path}`)
    let type = getType(props.path)
    const model =
      props.monaco.editor.getModel(uri) || props.monaco.editor.createModel('', type, uri)
    props.editor.setModel(model)
  })

  createEffect(() => {
    if (props.tsconfig) {
      props.monaco.languages.typescript.typescriptDefaults.setCompilerOptions(props.tsconfig)
      props.monaco.languages.typescript.javascriptDefaults.setCompilerOptions(props.tsconfig)
    }
  })

  createEffect(
    mapArray(
      () => Object.keys(props.types ?? {}),
      name => {
        createEffect(() => {
          const declaration = props.types?.[name]
          if (!declaration) return
          const path = `file:///${name}`
          props.monaco.languages.typescript.typescriptDefaults.addExtraLib(declaration, path)
          props.monaco.languages.typescript.javascriptDefaults.addExtraLib(declaration, path)
        })
      },
    ),
  )
}
