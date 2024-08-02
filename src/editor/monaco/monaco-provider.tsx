import { Monaco } from '@monaco-editor/loader'
import {
  ParentProps,
  Resource,
  Suspense,
  createContext,
  createEffect,
  mergeProps,
  useContext,
} from 'solid-js'
import { formatWarn } from 'src/utils/format-log'
import ts from 'typescript'
import { MonacoTheme, createMonaco } from './create-monaco'

const monacoContext = createContext<{
  monaco: Resource<Monaco>
  tsconfig: ts.CompilerOptions
}>()
export const useMonacoContext = (
  config: MonacoProviderProps,
): { monaco: Resource<Monaco>; tsconfig: ts.CompilerOptions } => {
  const context = useContext(monacoContext)
  // A <MonacoEditor/> created outside a <MonacoProvider/>
  if (!context) {
    return {
      monaco: createMonaco(
        mergeProps(config, {
          get theme() {
            const _theme = config.theme
            if (!_theme) {
              throw `A <MonacoEditor/> mounted outside a <MonacoProvider/> requires its theme-prop to be defined.`
            }
            return _theme
          },
          get monaco() {
            const _monaco = config.monaco
            if (!_monaco) {
              throw `A <MonacoEditor/> mounted outside a <MonacoProvider/> requires its monaco-prop to be defined.`
            }
            return _monaco
          },
          tsconfig: {},
        }),
      ),
      tsconfig: {},
    }
  }
  createEffect(() => {
    if (!config.theme) return
    console.warn(
      ...formatWarn(
        'Theme-prop of a <MonacoEditor/> mounted inside a <MonacoProvider/> is ignored.',
      ),
    )
  })
  createEffect(() => {
    if (!config.monaco) return
    console.warn(
      ...formatWarn(
        'Monaco-prop of a <MonacoEditor/> mounted inside a <MonacoProvider/> is ignored.',
      ),
    )
  })
  return context
}

export interface MonacoProviderProps {
  /** Required static or dynamic import of `Monaco` */
  monaco: Promise<Monaco> | Monaco
  /** Required static or dynamic import of a `MonacoTheme`. Needs to be optimized to make use of TextMate. */
  theme: MonacoTheme | Promise<MonacoTheme>
  /** Optional compiler options for typescript */
  tsconfig?: ts.CompilerOptions
}

export function MonacoProvider(props: ParentProps<MonacoProviderProps>) {
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
