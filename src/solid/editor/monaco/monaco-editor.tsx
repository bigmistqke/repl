import { Monaco } from '@monaco-editor/loader'
import {
  ComponentProps,
  createEffect,
  createMemo,
  onCleanup,
  Show,
  splitProps,
  untrack,
} from 'solid-js'
import { CssFile, Runtime } from 'src/runtime'
import { useRuntime } from 'src/solid/use-runtime'
import { every, whenever } from 'src/utils/conditionals'
import { Without } from 'src/utils/type-utils'
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
  console.log('THIS HAPPENS!')
  const runtime = useRuntime()
  const context = useMonacoContext(props)

  return (
    <Show when={context.monaco()}>
      {monaco => (
        <MonacoEditor.Standalone
          {...props}
          runtime={runtime}
          monaco={monaco()}
          tsconfig={context.tsconfig}
        />
      )}
    </Show>
  )
}

/** Standalone version of `<DevTools/>`. For use outside of `<Repl/>`-context. */
MonacoEditor.Standalone = function (
  props: Without<MonacoEditorProps, 'monaco'> & {
    runtime: Runtime
    monaco: Monaco
  },
) {
  const [rest] = splitProps(props, ['class', 'style'])
  // Initialize html-element of monaco-editor
  const container = (<div {...rest} />) as HTMLDivElement

  const editor = createMemo(() =>
    props.monaco.editor.create(container, {
      value: '',
      language: 'typescript',
      automaticLayout: true,
      ...props.editor,
    }),
  )

  // Get or create file
  const file = createMemo(
    () => props.runtime.fileSystem.get(props.path) || props.runtime.fileSystem.create(props.path),
  )

  const model = createMemo(
    whenever(every(props.monaco, file), ([monaco, file]) => {
      const uri = monaco.Uri.parse(`file:///${file.path}`)
      const source = untrack(file.get.bind(file))
      const type = file instanceof CssFile ? 'css' : 'typescript'
      return monaco.editor.getModel(uri) || monaco.editor.createModel(source || '', type, uri)
    }),
  )

  createEffect(
    whenever(every(props.monaco, editor), ([monaco, editor]) => {
      // Call onMount-prop
      props.onMount?.(editor)

      // Link model with file in file-system
      createEffect(
        whenever(model, model => {
          // Update monaco-editor's model to current file's model
          editor.setModel(model)
          // Update the file when the model changes content
          model.onDidChangeContent(() => file().set(model.getValue()))
        }),
      )

      // Dispose monaco-editor after cleanup
      onCleanup(() => editor.dispose())
    }),
  )

  return container
}
