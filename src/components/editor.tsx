import { ComponentProps, createEffect, createMemo, onCleanup, onMount, splitProps } from 'solid-js'

import { Monaco } from '@monaco-editor/loader'
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

  // Get or create file
  const file = createMemo(() => repl.fs.get(props.path) || repl.fs.create(props.path))

  // Create monaco-editor
  const editor = repl.fs.monaco.editor.create(container, {
    value: '',
    language: 'typescript',
    automaticLayout: true,
  })

  onMount(() => props.onMount?.(editor))

  // Update monaco-editor's model to current file's model
  createEffect(() => when(file)(file => editor.setModel(file.model)))

  // Add action to context-menu of monaco-editor
  createEffect(() => {
    if (repl.fs.config.actions?.saveRepl === false) return
    const cleanup = editor.addAction({
      id: 'save-repl',
      label: 'Save Repl',
      keybindings: [repl.fs.monaco.KeyMod.CtrlCmd | repl.fs.monaco.KeyCode.KeyY], // Optional: set a keybinding
      precondition: undefined,
      keybindingContext: undefined,
      contextMenuGroupId: 'repl',
      run: () => repl.fs.download(),
    })
    onCleanup(() => cleanup.dispose())
  })

  // Dispose monaco-editor after cleanup
  onCleanup(() => editor.dispose())

  return container
}
