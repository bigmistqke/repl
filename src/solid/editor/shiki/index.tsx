import { Runtime } from '@bigmistqke/repl/runtime'
import { createMemo, splitProps } from 'solid-js'
import { ShikiTextarea, ShikiTextareaProps } from 'solid-shiki-textarea'
import { useRuntime } from 'src/solid/use-runtime'

interface ShikiEditorProps extends Omit<ShikiTextareaProps, 'value'> {
  /** The path of the file in the virtual filesystem. */
  path: string
}

export function ShikiEditor(props: ShikiEditorProps) {
  const runtime = useRuntime()
  return <ShikiEditor.Standalone {...props} runtime={runtime} />
}

const MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  jsx: 'jsx',
  wat: 'wat',
  css: 'css',
  js: 'javascript',
}

/** Standalone version of `<ShikiEditor/>`. For use outside of `<Repl/>`-context. */
ShikiEditor.Standalone = function (props: ShikiEditorProps & { runtime: Runtime }) {
  const [config, rest] = splitProps(props, ['path', 'onInput'])

  // Get or create file
  const file = createMemo(
    () => props.runtime.fileSystem.get(config.path) || props.runtime.fileSystem.create(config.path),
  )

  return <ShikiTextarea value={file().get()} onInput={e => file().set(e.target.value)} {...rest} />
}
