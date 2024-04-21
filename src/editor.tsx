import clsx from 'clsx'
import {
  Component,
  ComponentProps,
  createEffect,
  createMemo,
  onCleanup,
  splitProps,
  untrack,
} from 'solid-js'

import { useFileSystem } from './context'
import { when } from './utils'

// @ts-expect-error
import styles from './editor.module.css'

export const Editor: Component<
  ComponentProps<'div'> & {
    initialValue?: string
    onCompilation?: (module: { module: Record<string, any>; url: string }) => void
    name: string
    mode?: 'light' | 'dark'
    import?: string
  }
> = props => {
  const [, htmlProps] = splitProps(props, ['initialValue'])
  const fileSystem = useFileSystem()
  let container: HTMLDivElement

  // Get or create file
  const file = createMemo(() =>
    when(fileSystem)(fileSystem => {
      const file = untrack(() => fileSystem.get(props.name)) || fileSystem.create(props.name)
      if (props.initialValue) file.set(props.initialValue)
      return file
    }),
  )

  // Create Monaco-instance
  createEffect(() => {
    when(
      fileSystem,
      file,
    )(({ monaco }, { model }) => {
      const editor = monaco.editor.create(container, {
        value: untrack(() => props.initialValue) || '',
        language: 'typescript',
        automaticLayout: true,
        theme: untrack(() => props.mode) === 'dark' ? 'vs-dark' : 'vs-light',
        model,
      })

      // Switch light/dark mode
      createEffect(() => {
        monaco.editor.setTheme(props.mode === 'light' ? 'vs-light' : 'vs-dark')
      })

      // Dispose after cleanup
      onCleanup(() => editor.dispose())
    })
  })

  return (
    <div class={clsx(styles['editor-container'])}>
      <div ref={container!} {...htmlProps} class={styles['editor']} />
    </div>
  )
}
