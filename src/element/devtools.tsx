import { useRuntime } from '@bigmistqke/repl/element/runtime'
import { DevTools } from '@bigmistqke/repl/solid'
import { element, Element, ElementAttributes, stringAttribute } from '@lume/element'
import { Show } from 'solid-js'

/**********************************************************************************/
/*                                                                                */
/*                                      Types                                     */
/*                                                                                */
/**********************************************************************************/

type ShikiTextareaAttributes = ElementAttributes<ReplDevtools, 'name'>

declare module 'solid-js/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      'repl-devtools': ShikiTextareaAttributes
    }
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'repl-devtools': ShikiTextareaAttributes
    }
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                  Repl Devtools                                 */
/*                                                                                */
/**********************************************************************************/

@element('repl-devtools')
export class ReplDevtools extends Element {
  @stringAttribute name = 'default'

  template = () => (
    <Show when={useRuntime(this)?.()}>
      {runtime => <DevTools.Standalone name={this.name} runtime={runtime()} />}
    </Show>
  )
}

export function registerDevtools() {
  if (!customElements.get('repl-frame')) {
    customElements.define('repl-frame', ReplDevtools)
  }
}