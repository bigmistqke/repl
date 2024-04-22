import { ComponentProps, createEffect, mergeProps, onCleanup, splitProps, untrack } from 'solid-js'
import { useRepl } from './use-repl'

import clsx from 'clsx'
// @ts-expect-error
import styles from './repl.module.css'

export type FrameProps = ComponentProps<'iframe'> & { name?: string }

export function Frame(props: FrameProps) {
  const [, rest] = splitProps(props, ['class'])
  const config = mergeProps({ name: 'default' }, props)
  const repl = useRepl()
  let ref: HTMLIFrameElement

  createEffect(() => {
    if (untrack(() => repl.frames.get(config.name))) {
      console.warn(`A frame with the same name already exist: ${config.name}`)
      return
    }
    repl.frames.set(config.name, ref.contentWindow!)
    onCleanup(() => repl.frames.delete(config.name))
  })

  return <iframe ref={ref!} class={clsx(styles.frame, props.class)} {...rest} />
}
