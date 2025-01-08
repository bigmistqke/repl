import { Frame, Runtime } from '@bigmistqke/repl'
import clsx from 'clsx'
import { ComponentProps, onMount, splitProps } from 'solid-js'
import { formatError } from 'src/utils/format-log'
import { html } from 'src/utils/object-url-literal'
import styles from './frame.module.css'

interface ReplFrameProps extends ComponentProps<'iframe'> {
  name?: string
  runtime: Runtime
  onReady?: (frame: Frame) => void
}

export function ReplFrame(props: ReplFrameProps) {
  const [config, iframeProps] = splitProps(props, ['class', 'runtime', 'onReady'])
  return (
    <iframe
      {...iframeProps}
      class={clsx(styles.frame, config.class)}
      ref={iframe => {
        onMount(() => {
          if (!iframe.contentWindow) {
            console.error(...formatError('contentWindow is not defined on iframe:', iframe))
            return
          }
          const onReady = () => {
            const frame = new Frame(iframe)
            iframe.contentWindow?.removeEventListener('DOMContentLoaded', onReady)
            config.onReady?.(frame)
          }

          iframe.contentWindow.addEventListener('DOMContentLoaded', onReady)
        })
      }}
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
