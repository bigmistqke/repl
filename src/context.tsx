import loader, { Monaco } from '@monaco-editor/loader'
import { ParentComponent, Resource, createContext, createResource, useContext } from 'solid-js'

export type MonacoContextType = { monaco: Monaco; worker: TypescriptWorker }
const MonacoContext = createContext<Resource<MonacoContextType>>()
export const useMonacoContext = () => useContext(MonacoContext)

type TypescriptWorker = Awaited<
  ReturnType<Monaco['languages']['typescript']['getTypeScriptWorker']>
>

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

      // we can not get the typescript-worker before an editor is instantiated
      monaco.editor.create(document.createElement('div'), {
        value: '',
        language: 'typescript',
      })

      const worker = await monaco.languages.typescript.getTypeScriptWorker()
      return { monaco, worker }
    } catch (error) {
      console.log('error', error)
    }
  })

  return <MonacoContext.Provider value={resource}>{props.children}</MonacoContext.Provider>
}
