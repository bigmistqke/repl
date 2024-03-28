import loader, { Monaco } from '@monaco-editor/loader'
import { ParentComponent, Resource, createContext, createResource, useContext } from 'solid-js'
import { TypeRegistry } from './type-registry'

const MonacoContext = createContext<Resource<{ monaco: Monaco; typeRegistry: TypeRegistry }>>()
export const useMonacoContext = () => useContext(MonacoContext)

export const MonacoProvider: ParentComponent = props => {
  const [resource] = createResource(async () => {
    try {
      const monaco = await (loader.init() as Promise<Monaco>)
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        allowJs: true,
        allowNonTsExtensions: true,
        esModuleInterop: true,
        jsx: monaco.languages.typescript.JsxEmit.React,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        target: monaco.languages.typescript.ScriptTarget.ESNext,
        paths: {},
      })

      return { monaco, typeRegistry: new TypeRegistry(monaco) }
    } catch (error) {
      console.log('error', error)
      throw error
    }
  })

  return <MonacoContext.Provider value={resource}>{props.children}</MonacoContext.Provider>
}
