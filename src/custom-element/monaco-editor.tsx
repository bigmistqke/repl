import { MonacoEditor } from '@bigmistqke/repl/editor/monaco'
import { Element, element, ElementAttributes, stringAttribute } from '@lume/element'
import { Monaco } from '@monaco-editor/loader'
import { createMemo, createRoot, createSignal, Show } from 'solid-js'
import { createMonaco, MonacoTheme } from 'src/solid/editor/monaco/create-monaco'
import { every, when } from 'src/utils/conditionals'
import ts from 'typescript'
import { runtime } from './'

/**********************************************************************************/
/*                                                                                */
/*                                      Types                                     */
/*                                                                                */
/**********************************************************************************/

type ReplMonacoAttributes = ElementAttributes<ReplMonacoEditor, 'path' | 'theme'>

declare module 'solid-js/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      'repl-monaco-editor': ReplMonacoAttributes
    }
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'repl-monaco-editor': ReplMonacoAttributes
    }
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                 Monaco Global                                  */
/*                                                                                */
/**********************************************************************************/

const [monaco, setMonacoDetails] = createRoot(() => {
  const [monacoDetails, setMonacoDetails] = createSignal<{
    theme: MonacoTheme
    tsconfig: ts.CompilerOptions
    monaco: Promise<Monaco>
  }>()

  const monacoResource = createMemo(() =>
    when(every(runtime, monacoDetails), ([runtime, { tsconfig, theme, monaco }]) =>
      createMonaco({
        runtime,
        monaco,
        tsconfig,
        theme,
      }),
    ),
  )

  const monaco = () => monacoResource()?.()

  return [monaco, setMonacoDetails]
})

/**********************************************************************************/
/*                                                                                */
/*                               Repl Monaco Editor                               */
/*                                                                                */
/**********************************************************************************/

@element('repl-monaco-editor')
class ReplMonacoEditor extends Element {
  hasShadow = false
  @stringAttribute path = ''
  @stringAttribute lang = ''
  @stringAttribute theme: MonacoTheme | undefined = undefined

  template = () => {
    return (
      <Show when={every(monaco, runtime)()} keyed>
        {([monaco, runtime]) => (
          <MonacoEditor.Standalone
            style={{ height: '100%' }}
            monaco={monaco}
            path={this.path}
            runtime={runtime}
          />
        )}
      </Show>
    )
  }
}

export { setMonacoDetails as setMonaco }
