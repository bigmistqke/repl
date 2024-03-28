import clsx from 'clsx'
import { Component, ComponentProps, createEffect, createMemo, splitProps, untrack } from 'solid-js'

import { useMonacoContext } from './context'
import { when } from './utils'

import styles from './editor.module.css'

export const Editor: Component<
  ComponentProps<'div'> & {
    initialValue?: string
    onCompilation?: (module: { module: Record<string, any>; url: string }) => void
    name: string
    mode?: 'light' | 'dark'
  }
> = props => {
  const [, htmlProps] = splitProps(props, ['initialValue'])

  const context = useMonacoContext()

  let container: HTMLDivElement

  // Create monaco-model
  const monacoModel = createMemo(() =>
    when(context)(({ monaco }) =>
      monaco.editor.createModel(
        untrack(() => props.initialValue) || '',
        'typescript',
        monaco.Uri.parse(`file:///${props.name}.ts`),
      ),
    ),
  )

  // Create monaco-instance
  createEffect(() => {
    when(
      context,
      monacoModel,
    )(async ({ monaco, typeRegistry }, model) => {
      const editor = monaco.editor.create(container, {
        value: untrack(() => props.initialValue) || '',
        language: 'typescript',
        automaticLayout: true,
        theme: untrack(() => props.mode) === 'dark' ? 'vs-dark' : 'vs-light',
        model,
      })

      // Import external import's types
      let timeout: any
      editor.onKeyUp(() => {
        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(async () => {
          const value = editor.getValue()
          typeRegistry.importTypesFromCode(value)
          const transpiledCode = await typeRegistry.transpileCodeFromModel(model)
          props.onCompilation?.(transpiledCode)
        }, 500)
      })

      // Switch light/dark mode
      createEffect(() => {
        monaco.editor.setTheme(props.mode === 'light' ? 'vs-light' : 'vs-dark')
      })
    })
  })

  return (
    <div class={clsx(styles['editor-container'])}>
      <div ref={container!} {...htmlProps} class={styles['editor']} />
    </div>
  )
}
