import { ComponentProps, createEffect, splitProps } from 'solid-js'
import { useFileSystem } from './repl'

import clsx from 'clsx'
// @ts-expect-error
import styles from './repl.module.css'

export type FrameProps = ComponentProps<'iframe'> & { name?: string }

export function Frame(props: FrameProps) {
  const [, rest] = splitProps(props, ['class'])
  const fileSystem = useFileSystem()
  let ref: HTMLIFrameElement

  createEffect(() => fileSystem.setFrame(ref.contentWindow!))

  return <iframe ref={ref!} class={clsx(styles.frame, props.class)} {...rest} />
}
