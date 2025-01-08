import { Frame, Runtime } from '@bigmistqke/repl'
import clsx from 'clsx'
import { ComponentProps, createResource, onCleanup } from 'solid-js'
import { whenEffect } from 'src/utils/conditionals'
import { html, javascript } from 'src/utils/object-url-literal'
import { waitForEvent } from 'src/utils/wait-for-load'
import styles from './devtools.module.css'

export function ReplDevtools(
  props: Exclude<ComponentProps<'iframe'>, 'src'> & {
    name?: string
    runtime: Runtime
    frame: Frame
  },
) {
  const chiiModule = html`<!doctype html>
    <html lang="en">
      <meta charset="utf-8" />
      <title>DevTools</title>
      <style>
        @media (prefers-color-scheme: dark) {
          body {
            background-color: rgb(41 42 45);
          }
        }
      </style>
      <meta name="referrer" content="no-referrer" />
      <script src="https://unpkg.com/@ungap/custom-elements/es.js"></script>
      <script
        type="module"
        src="https://cdn.jsdelivr.net/npm/chii@1.8.0/public/front_end/entrypoints/chii_app/chii_app.js"
      ></script>
      <body class="undocked" id="-blink-dev-tools"></body>
    </html>`

  const chobitsuModule = javascript`
      import('https://cdn.jsdelivr.net/npm/chobitsu').then(shobitsu => {
        const sendToDevtools = (message) => {
          window.parent.postMessage(JSON.stringify(message), '*');
        };
        let id = 0;
        const sendToChobitsu = (message) => {
          message.id = 'tmp' + ++id;
          chobitsu.sendRawMessage(JSON.stringify(message));
        };
        chobitsu.setOnMessage((message) => {
          if (message.includes('"id":"tmp')) return;
          window.parent.postMessage(message, '*');
        });
        window.addEventListener('message', ({ data }) => {
          try {
            const { event, value } = data;
            if (event === 'DEV') {
              chobitsu.sendRawMessage(data.data);
            } else if (event === 'LOADED') {
              sendToDevtools({
                method: 'Page.frameNavigated',
                params: {
                  frame: {
                    id: '1',
                    mimeType: 'text/html',
                    securityOrigin: location.origin,
                    url: location.href,
                  },
                  type: 'Navigation',
                },
              });
              sendToChobitsu({ method: 'Network.enable' });
              sendToDevtools({ method: 'Runtime.executionContextsCleared' });
              sendToChobitsu({ method: 'Runtime.enable' });
              sendToChobitsu({ method: 'Debugger.enable' });
              sendToChobitsu({ method: 'DOMStorage.enable' });
              sendToChobitsu({ method: 'DOM.enable' });
              sendToChobitsu({ method: 'CSS.enable' });
              sendToChobitsu({ method: 'Overlay.enable' });
              sendToDevtools({ method: 'DOM.documentUpdated' });
            }
          } catch (e) {
            console.error(e);
          }
        });
      })`

  return (
    <iframe
      {...props}
      class={clsx(props.class, styles.iframe)}
      ref={element => {
        const [target] = createResource(
          () => props.frame,
          frame => {
            if (frame.contentWindow.document.readyState === 'interactive') return frame
            return waitForEvent(frame.contentWindow, 'DOMContentLoaded').then(() => frame)
          },
        )

        whenEffect(target, target => {
          const messageListener = (event: MessageEvent) => {
            if (event.source === target.contentWindow) {
              element.contentWindow!.postMessage(event.data, '*')
            }
            if (event.source === element.contentWindow) {
              target.contentWindow!.postMessage({ event: 'DEV', data: event.data }, '*')
            }
          }
          window.addEventListener('message', messageListener)
          onCleanup(() => window.removeEventListener('message', messageListener))
        })

        whenEffect(target, targetFrame => targetFrame.injectModuleUrl(chobitsuModule))
      }}
      src={`${chiiModule}#?embedded=${encodeURIComponent(location.origin)}`}
    />
  )
}
