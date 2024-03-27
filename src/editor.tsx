import clsx from 'clsx'
import {
  Component,
  ComponentProps,
  createEffect,
  createMemo,
  createSignal,
  splitProps,
  untrack,
} from 'solid-js'

import { useMonacoContext } from './context'
import { when } from './utils'

import styles from './editor.module.css'
import { resolveExternalTypes } from './resolve-types'

function modifyImportPaths(code: string, alias?: Record<string, string>) {
  return code.replace(/import ([^"']+) from ["']([^"']+)["']/g, (match, varName, path) => {
    if (alias) {
      const entries = Object.entries(alias)
      for (let i = 0; i < entries.length; i++) {
        const [key, value] = entries[i]
        if (path.startsWith(key)) {
          return `import ${varName} from "${value}"`
        }
      }
    }
    if (
      path.startsWith('blob:') ||
      path.startsWith('http:') ||
      path.startsWith('https:') ||
      path.startsWith('.')
    ) {
      return `import ${varName} from "${path}"`
    } else {
      return `import ${varName} from "https://esm.sh/${path}"`
    }
  })
}

export const Editor: Component<
  Omit<ComponentProps<'div'>, 'onBlur'> & {
    initialValue?: string
    onCompilation?: (module: { module: Record<string, any>; url: string }) => void
    name: string
    mode?: 'light' | 'dark'
  }
> = props => {
  const [, htmlProps] = splitProps(props, ['initialValue', 'onBlur'])

  const context = useMonacoContext()
  const [code, setCode] = createSignal<string | undefined>(props.initialValue)

  let container: HTMLDivElement

  // Create monaco-model
  const model = createMemo(() =>
    when(context)(({ monaco }) =>
      monaco.editor.createModel(
        untrack(() => props.initialValue) || '',
        'typescript',
        monaco.Uri.parse(`file:///${props.name}.ts`),
      ),
    ),
  )

  // Compile typescript code to esm-module
  createEffect(() =>
    when(
      context,
      model,
      code,
    )(async (context, model) => {
      const typescriptWorker = await context.worker(model.uri)
      // use monaco's typescript-server to transpile file from ts to js
      typescriptWorker
        .getEmitOutput(`file://${model.uri.path}`)
        .then(text => (console.log(text), text))
        .then(async result => {
          if (result.outputFiles.length > 0) {
            // replace local imports with respective module-urls
            const code = modifyImportPaths(result.outputFiles[0]!.text)

            // get module-url of transpiled code
            const url = URL.createObjectURL(
              new Blob([code], {
                type: 'application/javascript',
              }),
            )

            const module = await import(/* @vite-ignore */ url)

            props.onCompilation?.({ module, url })
          }
        })
    }),
  )

  // Create monaco-instance
  createEffect(() => {
    when(
      context,
      model,
    )(async ({ monaco }, model) => {
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
        timeout = setTimeout(() => {
          const value = editor.getValue()

          resolveExternalTypes(monaco, value)

          const selection = editor.getSelection()
          editor.setValue(value)
          editor.setSelection(selection)

          setCode(value)
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
