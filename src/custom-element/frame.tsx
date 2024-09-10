import { Frame } from '@bigmistqke/repl'
import { element, Element, ElementAttributes, stringAttribute } from '@lume/element'
import { Show } from 'solid-js'
import { runtime } from './'

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
      <Show when={runtime()}>
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
