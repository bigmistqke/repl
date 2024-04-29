import clsx from 'clsx'
import { ComponentProps, For, JSXElement, splitProps } from 'solid-js'
import { File } from 'src/logic/file'
import { useRepl } from './use-repl'

// @ts-expect-error
import styles from './repl.module.css'

type ReplTabBarProps = Omit<ComponentProps<'div'>, 'children'> & {
  children: (arg: { path: string; paths: File | undefined }) => JSXElement
  files?: string[]
}

export function ReplTabBar(props: ReplTabBarProps) {
  const [, rest] = splitProps(props, ['class'])
  const repl = useRepl()

  const entries = () => {
    const files = repl.fs.all()
    if (props.files) {
      return props.files.map(path => [path, files[path]] as const)
    }
    return Object.entries(files)
  }
  return (
    <div class={clsx(styles.tabBar, props.class)} {...rest}>
      <For each={entries()}>{([path, file]) => props.children?.({ path, paths: file })}</For>
    </div>
  )
}
