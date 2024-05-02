import clsx from 'clsx'
import { ComponentProps, createEffect, createResource, onCleanup, splitProps } from 'solid-js'
import { Frame } from 'src/runtime'
import { whenever } from 'src/utils/conditionals'
import { html, javascript } from 'src/utils/object-url-literal'
import { useRepl } from '../use-repl'

// @ts-expect-error
import styles from './repl.module.css'

export type DevToolsProps = ComponentProps<'iframe'> & { name: string }

export function ReplDevTools(props: DevToolsProps) {
  const [, rest] = splitProps(props, ['class'])
  const repl = useRepl()

  const moduleUrl = html`<!doctype html>
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

  const iframe = (
    <iframe
      src={`${moduleUrl}#?embedded=${encodeURIComponent(location.origin)}`}
      class={clsx(props.class, styles.frame)}
      {...rest}
    />
  ) as HTMLIFrameElement

  const [targetFrame] = createResource(
    () => repl.frameRegistry.get(props.name),
    frame => {
      if (frame.contentWindow.document.readyState === 'interactive') return frame
      return new Promise<Frame>(resolve => {
        const handler = () => {
          resolve(frame)
          frame.contentWindow.removeEventListener('DOMContentLoaded', handler)
        }
        frame.contentWindow.addEventListener('DOMContentLoaded', handler)
      })
    },
  )

  createEffect(
    whenever(targetFrame, targetFrame => {
      const messageListener = (event: MessageEvent) => {
        if (event.source === targetFrame.contentWindow) {
          iframe.contentWindow!.postMessage(event.data, '*')
        }
        if (event.source === iframe.contentWindow) {
          targetFrame.contentWindow!.postMessage({ event: 'DEV', data: event.data }, '*')
        }
      }
      window.addEventListener('message', messageListener)
      onCleanup(() => window.removeEventListener('message', messageListener))
    }),
  )

  createEffect(
    whenever(targetFrame, targetFrame =>
      targetFrame.injectModuleUrl(javascript`
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
        })`),
    ),
  )

  return iframe
}
