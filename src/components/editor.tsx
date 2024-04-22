import clsx from 'clsx'
import { ComponentProps, createEffect, createMemo, onCleanup, splitProps, untrack } from 'solid-js'

import { when } from '../utils'
import { useRepl } from './use-repl'
// @ts-expect-error
import styles from './repl.module.css'

export type EditorProps = Omit<ComponentProps<'div'>, 'ref'> & {
  initialValue?: string
  path: string
  mode?: 'light' | 'dark'
  import?: string
}

export function Editor(props: EditorProps) {
  const [, htmlProps] = splitProps(props, ['initialValue'])
  const repl = useRepl()

  // Initialize html-element of monaco-editor
  const container = (<div {...htmlProps} class={styles['editor']} />) as HTMLDivElement

  // Get or create file
  const file = createMemo(() => repl.fs.get(props.path) || repl.fs.create(props.path))

  // Create monaco-editor
  const editor = repl.fs.monaco.editor.create(container, {
    value: '',
    language: 'typescript',
    automaticLayout: true,
    theme: untrack(() => props.mode) === 'dark' ? 'vs-dark' : 'vs-light',
  })

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

  // Switch light/dark mode of monaco-editor
  createEffect(() => {
    repl.fs.monaco.editor.setTheme(props.mode === 'light' ? 'vs-light' : 'vs-dark')
  })

  // Dispose monaco-editor after cleanup
  onCleanup(() => editor.dispose())

  return <div class={clsx(styles['editor-container'])}>{container}</div>
}
