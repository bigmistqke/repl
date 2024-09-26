import clsx from 'clsx'
import { ComponentProps, createResource, mergeProps, onCleanup, splitProps } from 'solid-js'
import { Frame, Runtime } from 'src/runtime'
import { whenEffect } from 'src/utils/conditionals'
import { html, javascript } from 'src/utils/object-url-literal'
import { useRuntime } from './'
import styles from './repl.module.css'

export interface DevToolsProps extends ComponentProps<'iframe'> {
  name?: string
}

/**
 * `DevTools` embeds an iframe to provide a custom Chrome DevTools interface for debugging purposes.
 * It connects to a `Frame` with the same `name` prop to display and interact with the frame's runtime environment,
 * including console outputs, DOM inspections, and network activities.
 *
 * @param props - Props include standard iframe attributes and a unique `name` used to link the DevTools
 *                with a specific `Frame`.
 * @returns The iframe element that hosts the embedded Chrome DevTools, connected to the specified `Frame`.
 * @example
 * // To debug a frame named 'exampleFrame':
 * <Frame name="exampleFrame" />
 * <DevTools name="exampleFrame" />
 */
export function DevTools(props: DevToolsProps) {
  const runtime = useRuntime()
  return <DevTools.Standalone runtime={runtime} {...props} />
}

/** Standalone version of `<DevTools/>`. For use outside of `<Repl/>`-context. */
DevTools.Standalone = function (props: DevToolsProps & { runtime: Runtime }) {
  const config = mergeProps({ name: 'default' }, props)
  const [, rest] = splitProps(config, ['class'])

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

  const iframe = (
    <iframe
      src={`${chiiModule}#?embedded=${encodeURIComponent(location.origin)}`}
      class={clsx(config.class, styles.frame)}
      {...rest}
    />
  ) as HTMLIFrameElement

  const [targetFrame] = createResource(
    () => props.runtime.frames.get(config.name),
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

  whenEffect(targetFrame, targetFrame => {
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
  })

  whenEffect(targetFrame, targetFrame => targetFrame.injectModuleUrl(chobitsuModule))

  return iframe
}
