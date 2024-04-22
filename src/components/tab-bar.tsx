import clsx from 'clsx'
import { ComponentProps, For, JSXElement, createContext, splitProps, useContext } from 'solid-js'
import { File } from 'src/logic/file'
import { useRepl } from './use-repl'

import styles from './repl.module.css'

export function TabBar(props: {
  class?: string
  children: (arg: TabContext) => JSXElement
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
      <For each={entries()}>
        {([path, file]) => (
          <tabContext.Provider value={{ path, file }}>
            {props.children?.({ path, file })}
          </tabContext.Provider>
        )}
      </For>
    </div>
  )
}

type TabContext = { path: string; file: File | undefined }
const tabContext = createContext<TabContext>()
const useTab = () => {
  const context = useContext(tabContext)
  if (!context) throw 'TabBar.Tab should be used within TabBar'
  return context
}
export function Tab(props: ComponentProps<'button'>) {
  const [, rest] = splitProps(props, ['children'])
  const tab = useTab()
  return <button {...rest}>{props.children || tab.path}</button>
}

TabBar.Tab = Tab
