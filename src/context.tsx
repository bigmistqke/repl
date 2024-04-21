import loader, { Monaco } from '@monaco-editor/loader'
import {
  ParentComponent,
  Resource,
  createContext,
  createResource,
  mergeProps,
  useContext,
} from 'solid-js'
import { JsxEmit, ModuleKind, ModuleResolutionKind, ScriptTarget } from 'typescript'
import { FileSystem, FileSystemState } from './file-system'

type FileSystemContext = Resource<FileSystem>
const fileSystemContext = createContext<FileSystemContext>()
export const useFileSystem = () => {
  const context = useContext(fileSystemContext)
  if (!context) throw 'useMonacoContext should be used inside <Monaco/>'
  return context
}

export type TypescriptConfig = Parameters<
  Monaco['languages']['typescript']['typescriptDefaults']['setCompilerOptions']
>[0]
export type BabelConfig = Partial<{ presets: string[]; plugins: string[] }>
export type MonacoConfig = Partial<{
  cdn: string
  babel: BabelConfig
  typescript: TypescriptConfig
  packages: string[]
  onFileSystem: (fileSystem: FileSystem) => void
  initialState: Partial<FileSystemState>
  addSaveConfigAction: boolean
}>

export const MonacoProvider: ParentComponent<MonacoConfig> = props => {
  const config = mergeProps({ cdn: 'https://esm.sh', addSaveConfigAction: true }, props)
  const typescript = () =>
    mergeProps(
      {
        allowJs: true,
        allowNonTsExtensions: true,
        esModuleInterop: true,
        allowUmdGlobalAccess: true,
        // enums inlined
        jsx: JsxEmit.Preserve as 1,
        module: ModuleKind.ESNext as 99,
        moduleResolution: ModuleResolutionKind.Node10 as 2,
        target: ScriptTarget.ESNext as 99,
        paths: {},
      },
      config.typescript,
    )

  const [fileSystemResource] = createResource(async () => {
    try {
      const monaco = await (loader.init() as Promise<Monaco>)
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions(typescript())
      {
        // initialize typescript-services with empty editor
        const editor = monaco.editor.create(document.createElement('div'), {
          language: 'typescript',
        })
        editor.dispose()
      }
      const fileSystem = await FileSystem.create(monaco, config)
      config.onFileSystem?.(fileSystem)
      return fileSystem
    } catch (error) {
      console.log('error', error)
      throw error
    }
  })

  return (
    <fileSystemContext.Provider value={fileSystemResource}>
      {config.children}
    </fileSystemContext.Provider>
  )
}
