import type * as Monaco from 'monaco-editor'
import { createEffect, mapArray, mergeProps, onCleanup } from 'solid-js'
import { createAsync } from 'src/utils/create-async.ts'
import { getExtension } from '../utils/path.ts'

export function bindMonacoToFileSystem(props: {
  editor: Monaco.editor.IStandaloneCodeEditor
  readFile: (path: string) => string
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
  const worker = createAsync(() => props.monaco.languages.typescript.getTypeScriptWorker())

  function getType(path: string) {
    const extension = getExtension(path)
    if (extension && extension in languages) {
      return languages[extension]!
    }
    return 'raw'
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
          const value = props.readFile(path) || ''
          if (value !== model.getValue()) {
            model.setValue(props.readFile(path) || '')
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

    const client = createAsync(() => worker()?.(model.uri))
    const diagnosis = createAsync(
      () => client()?.getSemanticDiagnostics(props.readFile(props.path)),
    )
    createEffect(() => {
      console.log('diagnosis', diagnosis())
    })
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
