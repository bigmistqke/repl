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
import { MonacoProviderProps, useMonacoContext } from './monaco-provider'

type MonacoEditor = ReturnType<Monaco['editor']['create']>
type MonacoEditorConfig = Parameters<Monaco['editor']['create']>[1]
type MonacoEditorPropsBase = Omit<ComponentProps<'div'>, 'ref'> & MonacoProviderProps
export interface MonacoEditorProps extends Partial<MonacoEditorPropsBase> {
  /** The path of the file in the virtual filesystem. */
  path: string
  /** Optional callback that is executed when the editor is fully mounted. */
  onMount?: (editor: MonacoEditor) => void
  /** Optional arguments to `monaco.editor.create()` */
  editor?: MonacoEditorConfig
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
  const context = useMonacoContext(props)

  // Initialize html-element of monaco-editor
  const container = (<div class={props.class} {...rest} />) as HTMLDivElement

  const [editor] = createResource(
    () => context.monaco(),
    monaco => {
      // Create monaco-editor
      return monaco.editor.create(container, {
        value: '',
        language: 'typescript',
        automaticLayout: true,
        ...props.editor,
      })
    },
  )

  // Get or create file
  const file = createMemo(
    () => runtime.fileSystem.get(props.path) || runtime.fileSystem.create(props.path),
  )

  const model = createMemo(
    whenever(every(context.monaco, file), ([monaco, file]) => {
      const uri = monaco.Uri.parse(`file:///${file.path}`)
      const source = untrack(() => file.get())
      const type = file instanceof CssFile ? 'css' : 'typescript'
      return monaco.editor.getModel(uri) || monaco.editor.createModel(source || '', type, uri)
    }),
  )

  createEffect(
    whenever(every(context.monaco, editor), ([monaco, editor]) => {
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
