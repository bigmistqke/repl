import {
  ComponentProps,
  createEffect,
  createMemo,
  mapArray,
  onCleanup,
  onMount,
  splitProps,
  untrack,
} from 'solid-js'

import { Monaco } from '@monaco-editor/loader'
import { CssFile } from '..'
import { when } from '../utils'
import { useRepl } from './use-repl'

type MonacoEditor = ReturnType<Monaco['editor']['create']>

export type EditorProps = Omit<ComponentProps<'div'>, 'ref'> & {
  /**
   * The path to the file that the editor should open and display.
   * This is used to retrieve or create the file in the virtual file system.
   */
  path: string
  /**
   * Optional callback that is executed when the editor is fully mounted.
   * @param editor
   * @returns
   */
  onMount?: (editor: MonacoEditor) => void
}

export function ReplEditor(props: EditorProps) {
  const [, rest] = splitProps(props, ['class'])
  const repl = useRepl()

  // Initialize html-element of monaco-editor
  const container = (<div class={props.class} {...rest} />) as HTMLDivElement

  // Create monaco-editor
  const editor = repl.libs.monaco.editor.create(container, {
    value: '',
    language: 'typescript',
    automaticLayout: true,
  })

  onMount(() => {
    props.onMount?.(editor)
    // Initialize models for all Files in FileSystem
    Object.entries(repl.fileSystem.all()).forEach(([path, value]) => {
      const uri = repl.libs.monaco.Uri.parse(`file:///${path}`)
      if (!repl.libs.monaco.editor.getModel(uri)) {
        const type = value instanceof CssFile ? 'css' : 'typescript'
        repl.libs.monaco.editor.createModel('', type, uri)
      }
    })
  })

  // Get or create file
  const file = createMemo(
    () => repl.fileSystem.get(props.path) || repl.fileSystem.create(props.path),
  )

  const model = createMemo(() =>
    when(file, file => {
      const uri = repl.libs.monaco.Uri.parse(`file:///${file.path}`)
      const source = untrack(() => file.get())
      const type = file instanceof CssFile ? 'css' : 'typescript'
      return (
        repl.libs.monaco.editor.getModel(uri) ||
        repl.libs.monaco.editor.createModel(source || '', type, uri)
      )
    }),
  )

  createEffect(() =>
    when(model, model => {
      // Set the value
      model.setValue(file().get())
      // Update the file when the model changes content
      model.onDidChangeContent(() => file().set(model.getValue()))
      // Update monaco-editor's model to current file's model
      editor.setModel(model)
    }),
  )

  // Add action to context-menu of monaco-editor
  createEffect(() => {
    if (repl.config.actions?.saveRepl === false) return
    const cleanup = editor.addAction({
      id: 'save-repl',
      label: 'Save Repl',
      keybindings: [repl.libs.monaco.KeyMod.CtrlCmd | repl.libs.monaco.KeyCode.KeyY], // Optional: set a keybinding
      precondition: undefined,
      keybindingContext: undefined,
      contextMenuGroupId: 'repl',
      run: () => repl.download(),
    })
    onCleanup(() => cleanup.dispose())
  })

  createEffect(
    mapArray(
      () => Object.keys(repl.typeRegistry.alias),
      key => {
        // add virtual path to monaco's tsconfig's `path`-property
        const tsCompilerOptions = {
          ...repl.config.typescript,
          paths: { ...repl.typeRegistry.alias, [key]: repl.typeRegistry.alias[key]! },
        }
        repl.libs.monaco.languages.typescript.typescriptDefaults.setCompilerOptions(
          tsCompilerOptions,
        )
        repl.libs.monaco.languages.typescript.javascriptDefaults.setCompilerOptions(
          tsCompilerOptions,
        )
      },
    ),
  )

  createEffect(
    mapArray(
      () => Object.keys(repl.typeRegistry.sources),
      virtualPath => {
        createEffect(() => {
          repl.libs.monaco.languages.typescript.typescriptDefaults.addExtraLib(
            repl.typeRegistry.sources[virtualPath]!,
            virtualPath,
          )
        })
      },
    ),
  )

  // Dispose monaco-editor after cleanup
  onCleanup(() => editor.dispose())

  return container
}
