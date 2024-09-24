import { useRuntime } from '@bigmistqke/repl/element/runtime'
import { Frame } from '@bigmistqke/repl/solid'
import { element, Element, ElementAttributes, stringAttribute } from '@lume/element'
import { Show } from 'solid-js'

/**********************************************************************************/
/*                                                                                */
/*                                      Types                                     */
/*                                                                                */
/**********************************************************************************/

type ShikiTextareaAttributes = ElementAttributes<ReplFrame, 'name'>

declare module 'solid-js/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      'repl-frame': ShikiTextareaAttributes
    }
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'repl-frame': ShikiTextareaAttributes
    }
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                   Repl Frame                                   */
/*                                                                                */
/**********************************************************************************/
@element('repl-frame')
export class ReplFrame extends Element {
  @stringAttribute name = 'default'

  template = () => {
    return (
      <Show when={useRuntime(this)?.()}>
        {runtime => (
          <Frame.Standalone
            name={this.name}
            runtime={runtime()}
            style={{ width: '100%', height: '100%', border: 'inherit' }}
          />
        )}
      </Show>
    )
  }
}

export function registerFrame() {
  if (!customElements.get('repl-frame')) {
    customElements.define('repl-frame', ReplFrame)
  }
}
