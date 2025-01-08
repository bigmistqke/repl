import { Frame, Runtime } from '@bigmistqke/repl'
import { element, Element, ElementAttributes, stringAttribute } from '@lume/element'
import { signal } from 'classy-solid'
import { onMount } from 'solid-js'
import { formatError } from 'src/utils/format-log'
import { html } from 'src/utils/object-url-literal'

/**********************************************************************************/
/*                                                                                */
/*                                      Types                                     */
/*                                                                                */
/**********************************************************************************/

type ShikiTextareaAttributes = ElementAttributes<ReplFrameElement, 'name' | 'runtime'>

declare module 'solid-js/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      'repl-frame': ShikiTextareaAttributes & { onReady: (event: FrameReadyEvent) => void }
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

class FrameReadyEvent extends Event {
  constructor(public frame: Frame) {
    super('ready')
  }
}
@element('repl-frame')
export class ReplFrameElement extends Element {
  @stringAttribute name = 'default'
  @signal runtime: Runtime | null | undefined = null
  @signal frame: Frame = null!

  static css = /* css */ `
    :host {
      display: block;
      position: relative;

      & iframe {
        border: none;
        position: absolute;
        height: 100%;
        width: 100%;
      }
    }
  `

  template = () => {
    return (
      <iframe
        ref={iframe => {
          onMount(() => {
            if (!iframe.contentWindow) {
              console.error(...formatError('contentWindow is not defined on iframe:', iframe))
              return
            }
            const onReady = () => {
              this.frame = new Frame(iframe)
              iframe.contentWindow?.removeEventListener('DOMContentLoaded', onReady)
              this.dispatchEvent(new FrameReadyEvent(this.frame))
            }

            iframe.contentWindow.addEventListener('DOMContentLoaded', onReady)
          })
        }}
        class="iframe"
        src={html`<!doctype html>
          <html>
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            </head>
            <body></body>
          </html>`}
      />
    )
  }
}

export function registerFrame() {
  if (!customElements.get('repl-frame')) {
    customElements.define('repl-frame', ReplFrameElement)
  }
}
