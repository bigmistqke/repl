import {
  ComponentProps,
  createEffect,
  mergeProps,
  onCleanup,
  splitProps,
  untrack,
  type JSX,
} from 'solid-js'
import { useRepl } from './use-repl'

import clsx from 'clsx'
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
  const [, rest] = splitProps(props, ['class'])
  const config = mergeProps({ name: 'default' }, props)
  const repl = useRepl()
  let ref: HTMLIFrameElement

  createEffect(() => {
    if (untrack(() => repl.frames.has(config.name))) {
      console.warn(`A frame with the same name already exist: ${config.name}`)
      return
    }
    repl.frames.add(config.name, ref.contentWindow!)
    onCleanup(() => repl.frames.delete(config.name))
  })

  createEffect(() => {
    if (!props.bodyStyle) return
    const bodyStyle =
      typeof props.bodyStyle === 'string'
        ? props.bodyStyle
        : Object.entries(props.bodyStyle)
            .map(([key, value]) => `${key}: ${value};`)
            .join('')
    ref.contentWindow?.document.body.setAttribute('style', bodyStyle)
  })

  return <iframe ref={ref!} class={clsx(styles.frame, props.class)} {...rest} />
}
