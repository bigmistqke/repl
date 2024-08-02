import { createMemo, splitProps } from 'solid-js'
import { ShikiTextarea, ShikiTextareaProps } from 'solid-shiki-textarea'
import { useRuntime } from 'src/use-runtime'

interface ShikiEditorProps extends Omit<ShikiTextareaProps, 'value'> {
  /** The path of the file in the virtual filesystem. */
  path: string
}

export function ShikiEditor(props: ShikiEditorProps) {
  const [config, rest] = splitProps(props, ['path', 'onInput'])
  const runtime = useRuntime()

  // Get or create file
  const file = createMemo(
    () => runtime.fileSystem.get(config.path) || runtime.fileSystem.create(config.path),
  )

  return <ShikiTextarea value={file().get()} onInput={value => file().set(value)} {...rest} />
}
