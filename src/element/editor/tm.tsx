import { useRuntime } from '@bigmistqke/repl/element/runtime'
import { element, Element, ElementAttributes, stringAttribute } from '@lume/element'
import { createMemo, Show } from 'solid-js'
import { last } from 'src/utils/last'
import { register } from 'tm-textarea'
import { Grammar, Theme } from 'tm-textarea/tm'

register()

/**********************************************************************************/
/*                                                                                */
/*                                      Types                                     */
/*                                                                                */
/**********************************************************************************/

type TmTextareaAttributes = ElementAttributes<ReplTmEditor, 'path' | 'theme' | 'oninput' | 'value'>

declare module 'solid-js/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      'repl-tm-editor': TmTextareaAttributes
    }
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'repl-tm-editor': TmTextareaAttributes
    }
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                    Get Lang                                    */
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

/**********************************************************************************/
/*                                                                                */
/*                                Repl Tm Editor                               */
/*                                                                                */
/**********************************************************************************/

@element('repl-tm-editor')
class ReplTmEditor extends Element {
  @stringAttribute path = ''
  @stringAttribute theme: Theme = 'andromeeda'

  css = /* css */ `
    :host {
      display: contents;
    }

    .tm-textarea {
      all: inherit;
    }
  `

  template = () => (
    <Show when={useRuntime(this)?.()}>
      {runtime => {
        const file = createMemo(() => runtime().fs.getOrCreate(this.path))
        console.log('THIS HAPPENS!!')
        this.createEffect(() => console.log('file content', file()?.get()))
        return (
          <tm-textarea
            class="tm-textarea"
            value={file().get()}
            onInput={e => file().set(e.currentTarget.value)}
            grammar={getGrammarName(file().path) as Grammar}
            theme={this.theme}
          />
        )
      }}
    </Show>
  )

  get value() {
    return ''
  }
}
