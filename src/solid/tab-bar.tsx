import clsx from 'clsx'
import { ComponentProps, For, JSXElement, splitProps } from 'solid-js'
import { VirtualFile } from 'src/runtime'
import { useRuntime } from 'src/solid/use-runtime'
import styles from './repl.module.css'

export interface TabBarProps extends Omit<ComponentProps<'div'>, 'children'> {
  /**
   * A render prop function that receives an object with the current path and file object.
   * It should return a `JSX.Element` to render for each tab.
   */
  children: (arg: { path: string; paths: VirtualFile | undefined }) => JSXElement
  /**
   * Optional array of file paths to specifically include in the tab bar.
   * If not provided, all files from the file system are used.
   */
  paths?: string[]
}

/**
 * `TabBar` is a utility-component to filter and sort `Files` of the virtual `FileSystem`.
 * This can be used to create a tab-bar to navigate between different files. It accepts an optional
 * prop of paths to sort and filter the files. If not provided it will display all existing files,
 * excluding files in the `node_modules` directory: This directory contains packages imported with
 * `FileSystem.importFromPackageJson()` and auto-imported types of external dependencies.
 *
 * @param props - The properties passed to the tab bar component.
 * @returns  The container div element that hosts the tabs for each file.
 */
export function TabBar(props: TabBarProps) {
  const [, rest] = splitProps(props, ['class', 'paths', 'children'])
  const runtime = useRuntime()

  const entries = () => {
    const files = runtime.fs.all()
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
