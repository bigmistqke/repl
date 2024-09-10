import { DevTools } from '@bigmistqke/repl'
import { element, Element, ElementAttributes, stringAttribute } from '@lume/element'
import { Show } from 'solid-js'
import { runtime } from './'

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

  template = () => {
    return (
      <Show when={runtime()}>
        {runtime => <DevTools.Standalone name={this.name} runtime={runtime()} />}
      </Show>
    )
  }
}
