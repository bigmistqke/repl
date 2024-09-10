import { element, Element, ElementAttributes, stringAttribute } from '@lume/element'
import { createMemo, Show } from 'solid-js'
import 'solid-shiki-textarea/custom-element'
import { whenever } from 'src/utils/conditionals'
import { last } from 'src/utils/last'
import { runtime } from './'

/**********************************************************************************/
/*                                                                                */
/*                                      Types                                     */
/*                                                                                */
/**********************************************************************************/

type ShikiTextareaAttributes = ElementAttributes<ReplShikiEditor, 'path' | 'theme'>

declare module 'solid-js/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      'repl-shiki-editor': ShikiTextareaAttributes
    }
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'repl-shiki-editor': ShikiTextareaAttributes
    }
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                    Get Lang                                    */
/*                                                                                */
/**********************************************************************************/

const MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  jsx: 'jsx',
  wat: 'wat',
  css: 'css',
  js: 'javascript',
}

function getLangName(path: string) {
  const extension = last(path.split('.'))
  return extension && MAP[extension]
}

/**********************************************************************************/
/*                                                                                */
/*                                Repl Shiki Editor                               */
/*                                                                                */
/**********************************************************************************/

@element('repl-shiki-editor')
class ReplShikiEditor extends Element {
  @stringAttribute path = ''
  @stringAttribute theme = 'andromeeda'

  css = /* css */ `
    .shiki-textarea {
      height: 100%;
      width: 100%;
    }
  `

  template = () => {
    // Get or create file
    const file = createMemo(whenever(runtime, runtime => runtime.fileSystem.getOrCreate(this.path)))

    return (
      <Show when={file()}>
        {file => (
          <shiki-textarea
            class="shiki-textarea"
            value={file().get()}
            onInput={e => file().set(e.target.value)}
            lang={getLangName(file().path)}
            theme={this.theme}
          />
        )}
      </Show>
    )
  }
}
