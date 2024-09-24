import { Runtime } from '@bigmistqke/repl'
import { createMemo, splitProps } from 'solid-js'
import { useRuntime } from 'src/solid/use-runtime'
import { last } from 'src/utils/last'
import { TmTextarea, TmTextareaProps } from 'tm-textarea/solid'
import { Grammar } from 'tm-textarea/tm'

interface TmEditorProps extends Omit<TmTextareaProps, 'value' | 'grammar'> {
  /** The path of the file in the virtual filesystem. */
  path: string
}

/**********************************************************************************/
/*                                                                                */
/*                                    Get Grammar                                    */
/*                                                                                */
/**********************************************************************************/

const MAP: Record<string, Grammar | string> = {
  ts: 'typescript',
  'module.css': 'css',
  tsx: 'tsx',
  jsx: 'jsx',
  wat: 'wat',
  css: 'css',
  js: 'javascript',
}

function getGrammarName(path: string) {
  const extension = last(path.split('.'))
  return extension && MAP[extension]
}

export function TmEditor(props: TmEditorProps) {
  const runtime = useRuntime()
  return <TmEditor.Standalone {...props} runtime={runtime} />
}

/** Standalone version of `<ShikiEditor/>`. For use outside of `<Repl/>`-context. */
TmEditor.Standalone = function (props: TmEditorProps & { runtime: Runtime }) {
  const [config, rest] = splitProps(props, ['path', 'onInput'])

  // Get or create file
  const file = createMemo(
    () => props.runtime.fs.get(config.path) || props.runtime.fs.create(config.path),
  )

  return (
    <TmTextarea
      grammar={getGrammarName(config.path) as Grammar}
      value={file().get()}
      onInput={e => file().set(e.currentTarget.value)}
      {...rest}
    />
  )
}
