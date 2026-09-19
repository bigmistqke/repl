import type * as Monaco from 'monaco-editor'
import { createEffect, createSignal, latest, mapArray, merge, onCleanup } from 'solid-js'
import * as PathUtils from '../path-utils.ts'

export function bindMonacoToFileSystem(props: {
  editor: Monaco.editor.IStandaloneCodeEditor
  readFile: (path: string) => string
  writeFile: (path: string, value: string) => void
  getPaths: () => string[]
  languages?: Record<string, string>
  monaco: typeof Monaco
  path: string
  tsconfig?: Monaco.languages.typescript.CompilerOptions
  types?: Record<string, string>
}) {
  const languages = merge(
    {
      tsx: 'typescript',
      ts: 'typescript',
    },
    () => props.languages,
  )
  const [workerSignal, setWorkerSignal] = createSignal<
    ((...uris: Monaco.Uri[]) => Promise<Monaco.languages.typescript.TypeScriptWorker>) | undefined
  >(() => props.monaco.languages.typescript.getTypeScriptWorker())
  setWorkerSignal(undefined)
  const worker = () => latest(workerSignal)

  function getType(path: string) {
    const extension = PathUtils.getExtension(path)
    if (extension && extension in languages) {
      return languages[extension]!
    }
    return 'raw'
  }

  createEffect(() => {
    props.editor.onDidChangeModelContent(() => {
      props.writeFile(props.path, props.editor.getModel()!.getValue())
    })
  }, () => {})

  createEffect(
    mapArray(props.getPaths, path => {
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
        }, () => {})
        onCleanup(() => model.dispose())
      }, () => {})
    }),
    () => {},
  )

  createEffect(() => {
    const uri = props.monaco.Uri.parse(`file:///${props.path}`)
    const type = getType(props.path)
    const model =
      props.monaco.editor.getModel(uri) || props.monaco.editor.createModel('', type, uri)
    props.editor.setModel(model)

    const [clientSignal, setClientSignal] = createSignal<
      Monaco.languages.typescript.TypeScriptWorker | undefined
    >(() => worker()?.(model.uri))
    setClientSignal(undefined)
    const client = () => latest(clientSignal)

    const [diagnosisSignal, setDiagnosisSignal] = createSignal<
      Monaco.languages.typescript.Diagnostic[] | undefined
    >(() => client()?.getSemanticDiagnostics(props.readFile(props.path)))
    setDiagnosisSignal(undefined)
    const diagnosis = () => latest(diagnosisSignal)
    createEffect(() => {
      console.info('diagnosis', diagnosis())
    }, () => {})
  }, () => {})

  createEffect(() => {
    if (props.tsconfig) {
      props.monaco.languages.typescript.typescriptDefaults.setCompilerOptions(props.tsconfig)
      props.monaco.languages.typescript.javascriptDefaults.setCompilerOptions(props.tsconfig)
    }
  }, () => {})

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
        }, () => {})
      },
    ),
    () => {},
  )
}
