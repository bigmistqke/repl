import clsx from 'clsx'
import { For, JSXElement, splitProps } from 'solid-js'
import { File } from 'src/logic/file'
import { useRepl } from './use-repl'

import styles from './repl.module.css'

export function TabBar(props: {
  class?: string
  children: (arg: { path: string; file: File | undefined }) => JSXElement
  files?: string[]
}) {
  const [, rest] = splitProps(props, ['class'])
  const repl = useRepl()

  const entries = () => {
    const files = repl.fs.all()
    if (props.files) {
      return props.files.map(fileName => [fileName, files[fileName]] as const)
    }
    return Object.entries(files)
  }
  return (
    <div class={clsx(styles.tabBar, props.class)} {...rest}>
      <For each={entries()}>{([path, file]) => props.children?.({ path, file })}</For>
    </div>
  )
}
