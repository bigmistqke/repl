import { Monaco } from '@monaco-editor/loader'
import { ParentProps, Resource, Suspense, createContext, createEffect, useContext } from 'solid-js'
import { formatWarn } from 'src/utils/format-log'
import { MonacoTheme, createMonaco } from './create-monaco'

const monacoContext = createContext<Resource<Monaco>>()
export const useMonaco = (
  theme: () => MonacoTheme | Promise<MonacoTheme> | undefined,
): Resource<Monaco> => {
  const context = useContext(monacoContext)
  // A <MonacoEditor/> created outside a <MonacoProvider/>
  if (!context) {
    return createMonaco(() => {
      const _theme = theme()
      if (!_theme) {
        throw `A <MonacoEditor/> mounted outside a <MonacoProvider/> requires its theme-prop to be defined.`
      }
      return _theme
    })
  }
  createEffect(() => {
    if (theme())
      console.warn(
        ...formatWarn(
          'Theme-prop of a <MonacoEditor/> mounted inside a <MonacoProvider/> are ignored.',
        ),
      )
  })
  return context
}

export function MonacoProvider(props: ParentProps<{ theme: MonacoTheme | Promise<MonacoTheme> }>) {
  const monaco = createMonaco(() => props.theme)
  return (
    <Suspense>
      <monacoContext.Provider value={monaco}>{props.children}</monacoContext.Provider>
    </Suspense>
  )
}
