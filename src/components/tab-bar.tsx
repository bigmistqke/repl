import clsx from 'clsx'
import { ComponentProps, For, JSXElement, splitProps } from 'solid-js'
import { File } from 'src/logic/file'
import { useRepl } from './use-repl'

// @ts-expect-error
import styles from './repl.module.css'

type ReplTabBarProps = Omit<ComponentProps<'div'>, 'children'> & {
  /**
   * A render prop function that receives an object with the current path and file object.
   * It should return a `JSX.Element` to render for each tab.
   */
  children: (arg: { path: string; paths: File | undefined }) => JSXElement
  /**
   * Optional array of file paths to specifically include in the tab bar.
   * If not provided, all files from the file system are used.
   */
  paths?: string[]
}

export function ReplTabBar(props: ReplTabBarProps) {
  const [, rest] = splitProps(props, ['class', 'paths', 'children'])
  const repl = useRepl()

  const entries = () => {
    const files = repl.fs.all()
    if (props.paths) {
      return props.paths.map(path => [path, files[path]] as const)
    }
    return Object.entries(files)
  }
  return (
    <div class={clsx(styles.tabBar, props.class)} {...rest}>
      <For each={entries()}>{([path, file]) => props.children?.({ path, paths: file })}</For>
    </div>
  )
}
