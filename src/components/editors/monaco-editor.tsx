import { Monaco } from '@monaco-editor/loader'
import {
  ComponentProps,
  createEffect,
  createMemo,
  createResource,
  onCleanup,
  splitProps,
  untrack,
} from 'solid-js'
import { CssFile } from 'src/runtime'
import { useRepl } from 'src/use-repl'
import { whenever } from 'src/utils/conditionals'
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
  editor: Parameters<Monaco['editor']['create']>[1]
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
      ...props.editor,
    })
  })

  // Get or create file
  const file = createMemo(
    () => repl.fileSystem.get(props.path) || repl.fileSystem.create(props.path),
  )

  const model = createMemo(
    whenever(file, file => {
      const uri = monaco.Uri.parse(`file:///${file.path}`)
      const source = untrack(() => file.get())
      const type = file instanceof CssFile ? 'css' : 'typescript'
      return monaco.editor.getModel(uri) || monaco.editor.createModel(source || '', type, uri)
    }),
  )

  createEffect(
    whenever(editor, editor => {
      // Call onMount-prop
      props.onMount?.(editor)

      // Link model with file in file-system
      createEffect(
        whenever(model, model => {
          // Update monaco-editor's model to current file's model
          editor.setModel(model)
          // Set the value
          model.setValue(file().get())
          // Update the file when the model changes content
          model.onDidChangeContent(() => file().set(model.getValue()))
        }),
      )

      // Add action to context-menu of monaco-editor
      createEffect(() => {
        if (repl.config.actions?.saveRepl === false) return
        const { dispose } = editor.addAction({
          id: 'save-repl',
          label: 'Save Repl',
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY], // Optional: set a keybinding
          precondition: undefined,
          keybindingContext: undefined,
          contextMenuGroupId: 'repl',
          run: () => repl.download(),
        })
        onCleanup(() => dispose())
      })

      // Dispose monaco-editor after cleanup
      onCleanup(() => editor.dispose())
    }),
  )

  return container
}
