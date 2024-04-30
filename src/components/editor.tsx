import {
  ComponentProps,
  createEffect,
  createMemo,
  onCleanup,
  onMount,
  splitProps,
  untrack,
} from 'solid-js'

import { Monaco } from '@monaco-editor/loader'
import { every, when } from '../utils'
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

  // Get or create file
  const file = createMemo(
    () => repl.fileSystem.get(props.path) || repl.fileSystem.create(props.path),
  )

  const model = createMemo(() =>
    when(file, file => {
      const uri = repl.libs.monaco.Uri.parse(`file:///${props.path.replace('./', '')}`)
      return (
        repl.libs.monaco.editor.getModel(uri) ||
        repl.libs.monaco.editor.createModel(untrack(() => file.get()) || '', 'typescript', uri)
      )
    }),
  )

  // Initialize html-element of monaco-editor
  const container = (<div class={props.class} {...rest} />) as HTMLDivElement

  createEffect(() =>
    when(every(file, model), ([file, model]) => {
      if (model.getValue() !== file.get()) {
        model.setValue(file.get())
      }
      model.onDidChangeContent(() => file.set(model.getValue()))
    }),
  )

  // Create monaco-editor
  const editor = repl.libs.monaco.editor.create(container, {
    value: '',
    language: 'typescript',
    automaticLayout: true,
  })

  onMount(() => props.onMount?.(editor))

  // Update monaco-editor's model to current file's model
  createEffect(() => when(model, model => editor.setModel(model)))

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

  // Dispose monaco-editor after cleanup
  onCleanup(() => editor.dispose())

  return container
}
