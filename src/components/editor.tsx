import clsx from 'clsx'
import { ComponentProps, createEffect, createMemo, onCleanup, splitProps, untrack } from 'solid-js'

import { FileSystem } from '../file-system'
import { every, when } from '../utils'
import { useFileSystem } from './repl'
// @ts-expect-error
import styles from './repl.module.css'

export type EditorProps = Omit<ComponentProps<'div'>, 'ref'> & {
  initialValue?: string
  onCompilation?: (event: { url: string; fileSystem: FileSystem }) => void
  name: string
  mode?: 'light' | 'dark'
  import?: string
}

export function Editor(props: EditorProps) {
  const [, htmlProps] = splitProps(props, ['initialValue'])
  const fileSystem = useFileSystem()
  let container: HTMLDivElement

  // Get or create file
  const file = createMemo(() => {
    const file = untrack(() => fileSystem.get(props.name)) || fileSystem.create(props.name)
    if (props.initialValue) file.set(props.initialValue)
    return file
  })

  // Create Monaco-instance
  createEffect(() => {
    when(file)(({ model }) => {
      const editor = fileSystem.monaco.editor.create(container, {
        value: untrack(() => props.initialValue) || '',
        language: 'typescript',
        automaticLayout: true,
        theme: untrack(() => props.mode) === 'dark' ? 'vs-dark' : 'vs-light',
        model,
      })

      createEffect(() => {
        if (fileSystem.config.actions?.saveRepl !== false) {
          const cleanup = editor.addAction({
            id: 'save-repl',
            label: 'Save Repl',
            keybindings: [fileSystem.monaco.KeyMod.CtrlCmd | fileSystem.monaco.KeyCode.KeyY], // Optional: set a keybinding
            precondition: undefined,
            keybindingContext: undefined,
            contextMenuGroupId: 'repl',
            run: () => fileSystem.download(),
          })
          onCleanup(() => cleanup.dispose())
        }
      })

      // Switch light/dark mode
      createEffect(() => {
        fileSystem.monaco.editor.setTheme(props.mode === 'light' ? 'vs-light' : 'vs-dark')
      })

      // Dispose after cleanup
      onCleanup(() => editor.dispose())
    })
  })

  createEffect(() =>
    when(every(file, () => props.onCompilation))(([file, handler]) => file.onCompilation(handler)),
  )

  return (
    <div class={clsx(styles['editor-container'])}>
      <div ref={container!} {...htmlProps} class={styles['editor']} />
    </div>
  )
}
