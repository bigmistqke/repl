import clsx from 'clsx'
import { ParentProps, mergeProps } from 'solid-js'

import styles from './repl.module.css'

export function Panel(props: ParentProps<Partial<{ column: boolean }>>) {
  const config = mergeProps({ column: false }, props)
  return <div class={clsx(styles.panel, config.column && styles.column)}>{props.children}</div>
}
