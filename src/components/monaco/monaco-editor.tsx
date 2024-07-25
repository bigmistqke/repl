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
import { useRuntime } from 'src/use-runtime'
import { every, whenever } from 'src/utils/conditionals'
import { useMonaco } from './monaco-provider'

type MonacoEditor = ReturnType<Monaco['editor']['create']>

export interface MonacoEditorProps extends Omit<ComponentProps<'div'>, 'ref'> {
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

/**
 * `Editor` embeds a `monaco-editor` instance for editing files.
 * It dynamically creates and binds a `monaco`-model and `File`
 * in the virtual `FileSystem` based on the provided `path`-prop.
 *
 * @param  props - The properties passed to the editor component.
 * @returns The container div element that hosts the Monaco editor.
 */
export function MonacoEditor(props: MonacoEditorProps) {
  const [, rest] = splitProps(props, ['class'])
  const runtime = useRuntime()
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
    () => runtime.fileSystem.get(props.path) || runtime.fileSystem.create(props.path),
  )

  const model = createMemo(
    whenever(every(monaco, file), ([monaco, file]) => {
      const uri = monaco.Uri.parse(`file:///${file.path}`)
      const source = untrack(() => file.get())
      const type = file instanceof CssFile ? 'css' : 'typescript'
      return monaco.editor.getModel(uri) || monaco.editor.createModel(source || '', type, uri)
    }),
  )

  createEffect(
    whenever(every(monaco, editor), ([monaco, editor]) => {
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
        if (runtime.config.actions?.saveRepl === false) return
        const { dispose } = editor.addAction({
          id: 'save-repl',
          label: 'Save Repl',
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY], // Optional: set a keybinding
          precondition: undefined,
          keybindingContext: undefined,
          contextMenuGroupId: 'repl',
          run: () => runtime.download(),
        })
        onCleanup(() => dispose())
      })

      // Dispose monaco-editor after cleanup
      onCleanup(() => editor.dispose())
    }),
  )

  return container
}
