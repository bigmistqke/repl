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
  name?: string
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
    repl.frames.set(config.name, ref.contentWindow!)
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
