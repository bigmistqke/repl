import { Monaco } from '@monaco-editor/loader'
// @ts-expect-error
import { ComponentProps, createResource, splitProps } from 'solid-js'
import { when } from 'src/utils'

// @ts-expect-error
import { createEffect, createMemo, mapArray, onCleanup, untrack } from 'solid-js'

const GRAMMARS = new Map([
  ['typescript', 'source.tsx'],
  ['javascript', 'source.tsx'],
  ['css', 'source.css'],
])

import { CssFile } from '../..'
import { useRepl } from '../use-repl'
import { useMonaco } from './monaco-provider'

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

export function ReplMonacoEditor(props: EditorProps) {
  const [, rest] = splitProps(props, ['class'])
  const repl = useRepl()
  const monaco = useMonaco()

  // Initialize html-element of monaco-editor
  const container = (<div class={props.class} {...rest} />) as HTMLDivElement

  const [editor] = createResource(monaco, monaco => {
    // Create monaco-editor
    return monaco.editor.create(container, {
      value: '',
      language: 'typescript',
      automaticLayout: true,
    })
  })

  // Get or create file
  const file = createMemo(
    () => repl.fileSystem.get(props.path) || repl.fileSystem.create(props.path),
  )

  const model = createMemo(() =>
    when(file, file => {
      const uri = monaco.Uri.parse(`file:///${file.path}`)
      const source = untrack(() => file.get())
      const type = file instanceof CssFile ? 'css' : 'typescript'
      return monaco.editor.getModel(uri) || monaco.editor.createModel(source || '', type, uri)
    }),
  )

  createEffect(() =>
    when(editor, editor => {
      // Call onMount-prop
      props.onMount?.(editor)

      // Initialize models for all Files in FileSystem
      Object.entries(repl.fileSystem.all()).forEach(([path, value]) => {
        const uri = monaco.Uri.parse(`file:///${path}`)
        if (!monaco.editor.getModel(uri)) {
          const type = value instanceof CssFile ? 'css' : 'typescript'
          monaco.editor.createModel('', type, uri)
        }
      })

      createEffect(() =>
        monaco.editor.setTheme(props.mode === 'light' ? 'vs-light-plus' : 'vs-dark-plus'),
      )

      createEffect(() =>
        when(model, model => {
          // Update monaco-editor's model to current file's model
          editor.setModel(model)
          // Set the value
          model.setValue(file().get())
          // Update the file when the model changes content
          model.onDidChangeContent(() => file().set(model.getValue()))
          // Add action to context-menu of monaco-editor
          createEffect(() => {
            if (repl.config.actions?.saveRepl === false) return
            const cleanup = editor.addAction({
              id: 'save-repl',
              label: 'Save Repl',
              keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY], // Optional: set a keybinding
              precondition: undefined,
              keybindingContext: undefined,
              contextMenuGroupId: 'repl',
              run: () => repl.download(),
            })
            onCleanup(() => cleanup.dispose())
          })
        }),
      )

      createEffect(
        mapArray(
          () => Object.keys(repl.typeRegistry.alias),
          key => {
            // add virtual path to monaco's tsconfig's `path`-property
            const tsCompilerOptions = {
              ...repl.config.typescript,
              paths: { ...repl.typeRegistry.alias, [key]: repl.typeRegistry.alias[key]! },
            }
            monaco.languages.typescript.typescriptDefaults.setCompilerOptions(tsCompilerOptions)
            monaco.languages.typescript.javascriptDefaults.setCompilerOptions(tsCompilerOptions)
          },
        ),
      )

      createEffect(
        mapArray(
          () => Object.keys(repl.typeRegistry.sources),
          virtualPath => {
            createEffect(() => {
              monaco.languages.typescript.typescriptDefaults.addExtraLib(
                repl.typeRegistry.sources[virtualPath]!,
                virtualPath,
              )
            })
          },
        ),
      )

      // Dispose monaco-editor after cleanup
      onCleanup(() => editor.dispose())
    }),
  )

  return container
}
