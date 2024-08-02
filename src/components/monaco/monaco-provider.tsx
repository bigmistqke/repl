import { Monaco } from '@monaco-editor/loader'
import { ParentProps, Resource, Suspense, createContext, createEffect, useContext } from 'solid-js'
import { formatWarn } from 'src/utils/format-log'
import ts from 'typescript'
import { MonacoTheme, createMonaco } from './create-monaco'

const monacoContext = createContext<{
  monaco: Resource<Monaco>
  tsconfig: ts.CompilerOptions
}>()
export const useMonacoContext = (
  theme: () => MonacoTheme | Promise<MonacoTheme> | undefined,
): { monaco: Resource<Monaco>; tsconfig: ts.CompilerOptions } => {
  const context = useContext(monacoContext)
  // A <MonacoEditor/> created outside a <MonacoProvider/>
  if (!context) {
    return {
      monaco: createMonaco({
        get theme() {
          const _theme = theme()
          if (!_theme) {
            throw `A <MonacoEditor/> mounted outside a <MonacoProvider/> requires its theme-prop to be defined.`
          }
          return _theme
        },
        tsconfig: {},
      }),
      tsconfig: {},
    }
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

export function MonacoProvider(
  props: ParentProps<{
    theme: MonacoTheme | Promise<MonacoTheme>
    tsconfig?: ts.CompilerOptions
  }>,
) {
  const monaco = createMonaco(props)
  return (
    <Suspense>
      <monacoContext.Provider
        value={{
          monaco,
          get tsconfig() {
            return props.tsconfig || {}
          },
        }}
      >
        {props.children}
      </monacoContext.Provider>
    </Suspense>
  )
}
