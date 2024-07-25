import { Monaco } from '@monaco-editor/loader'
import { ParentProps, Resource, Suspense, createContext, useContext } from 'solid-js'
import { createMonaco } from './create-monaco'

const monacoContext = createContext<Resource<Monaco>>()
export const useMonaco = (): Resource<Monaco> => {
  const context = useContext(monacoContext)
  if (!context) {
    return createMonaco()
  }
  return context
}

export function MonacoProvider(props: ParentProps) {
  const monaco = createMonaco()
  return (
    <Suspense>
      <monacoContext.Provider value={monaco}>{props.children}</monacoContext.Provider>
    </Suspense>
  )
}
