import clsx from 'clsx'
import {
  ComponentProps,
  createEffect,
  mergeProps,
  onCleanup,
  onMount,
  splitProps,
  type JSX,
} from 'solid-js'
import { html } from 'src/utils/module-literal'
import { useRepl } from '../use-repl'

// @ts-expect-error
import styles from './repl.module.css'

export type FrameProps = ComponentProps<'iframe'> & {
  /**
   * The unique identifier for the iframe, which is used to manage its presence in the global frame registry.
   * If not specified, 'default' is used as a fallback.
   */
  name?: string
  /**
   * Optional CSS properties or a string that defines the style of the iframe's body.
   */
  bodyStyle?: JSX.CSSProperties | string | undefined
}

export function ReplFrame(props: FrameProps) {
  const [, rest] = splitProps(props, ['class', 'bodyStyle', 'name'])
  const config = mergeProps({ name: 'default' }, props)
  const repl = useRepl()

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
      console.error('contentWindow is not defined on iframe:', iframe)
      return
    }

    const onReady = () => {
      if (repl.frameRegistry.has(config.name)) {
        console.warn(`A frame with the same name already exist: ${config.name}`)
        return
      }
      repl.frameRegistry.add(config.name, iframe.contentWindow!)
      iframe.contentWindow?.removeEventListener('DOMContentLoaded', onReady)
    }

    iframe.contentWindow.addEventListener('DOMContentLoaded', onReady)

    onCleanup(() => {
      console.log('cleanup!')
      repl.frameRegistry.delete(config.name)
    })

    createEffect(() => {
      if (!props.bodyStyle) return
      if (!iframe.contentWindow) {
        console.error('contentWindow is not defined on iframe:', iframe)
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
