import { Frame as FrameApi } from '@bigmistqke/repl'
import clsx from 'clsx'
import { ComponentProps, createEffect, mergeProps, onMount, splitProps, type JSX } from 'solid-js'
import { Runtime } from 'src/runtime/runtime'
import { useRuntime } from 'src/solid/use-runtime'
import { formatError } from 'src/utils/format-log'
import { html } from 'src/utils/object-url-literal'
import { Without } from 'src/utils/type-utils'
import styles from './repl.module.css'

export interface FrameProps extends ComponentProps<'iframe'> {
  /**
   * The unique identifier for the iframe, which is used to manage its presence in the global frame registry.
   * If not specified, 'default' is used as a fallback.
   */
  name?: string
  /**
   * Optional CSS properties or a string that defines the style of the iframe's body.
   */
  bodyStyle?: JSX.CSSProperties | string | undefined
  runtime: Runtime
  onReady?: (frame: FrameApi) => void
}

/**
 * `Frame` encapsulates an iframe element to provide an isolated execution
 * environment within the application. It is used to inject and execute CSS or JS module separately
 * from the main document flow.
 *
 * @param props - The props for configuring the iframe.
 * @returns The iframe element configured according to the specified props.
 *
 * @example
 * // To create an iframe with specific styles and a unique name:
 * <ReplFrame name="myCustomFrame" bodyStyle={{ backgroundColor: 'red' }} />
 */
export function Frame(props: Without<FrameProps, 'runtime'>) {
  const runtime = useRuntime()
  return <Frame.Standalone {...props} runtime={runtime} />
}

/** Standalone version of `<Frame/>`. For use outside of `<Repl/>`-context. */
Frame.Standalone = function (props: FrameProps) {
  const [, rest] = splitProps(props, ['class', 'bodyStyle', 'name'])
  const config = mergeProps({ name: 'default' }, props)

  const iframe = (
    <iframe
      src={html`<!doctype html>
        <html>
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          </head>
          <body></body>
        </html>`}
      class={clsx(styles.frame, props.class)}
      {...rest}
    />
  ) as HTMLIFrameElement

  onMount(() => {
    if (!iframe.contentWindow) {
      console.error(...formatError('contentWindow is not defined on iframe:', iframe))
      return
    }

    const frame = new FrameApi(iframe)

    const onReady = () => {
      iframe.contentWindow?.removeEventListener('DOMContentLoaded', onReady)
      props.onReady?.(frame)
    }

    iframe.contentWindow.addEventListener('DOMContentLoaded', onReady)

    createEffect(() => {
      if (!props.bodyStyle) return
      if (!iframe.contentWindow) {
        console.error(...formatError('contentWindow is not defined on iframe:', iframe))
        return
      }
      const bodyStyle =
        typeof props.bodyStyle === 'string'
          ? props.bodyStyle
          : Object.entries(props.bodyStyle)
              .map(([key, value]) => `${key}: ${value};`)
              .join('')
      iframe.contentWindow.document.body.setAttribute('style', bodyStyle)
    })
  })

  return iframe
}
