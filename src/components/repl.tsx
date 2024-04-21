import loader, { Monaco } from '@monaco-editor/loader'
import clsx from 'clsx'
import {
  ParentProps,
  Show,
  createContext,
  createEffect,
  createResource,
  mergeProps,
  useContext,
} from 'solid-js'
import { JsxEmit, ModuleKind, ModuleResolutionKind, ScriptTarget } from 'typescript'
import { CompilationHandler, FileSystem, FileSystemState } from '../file-system'

import { every, when } from '../utils'
import { Editor } from './editor'
import { Frame } from './frame'
import styles from './repl.module.css'

type FileSystemContext = FileSystem
const fileSystemContext = createContext<FileSystemContext>()
export const useFileSystem = () => {
  const context = useContext(fileSystemContext)
  if (!context) throw 'useMonacoContext should be used inside <Monaco/>'
  return context
}

export type TypescriptConfig = Parameters<
  Monaco['languages']['typescript']['typescriptDefaults']['setCompilerOptions']
>[0]
export type BabelConfig = Partial<{ presets: string[]; plugins: (string | babel.PluginItem)[] }>
export type ReplConfig = Partial<{
  class: string
  cdn: string
  babel: BabelConfig
  typescript: TypescriptConfig
  packages: string[]
  onFileSystem: (fileSystem: FileSystem) => void
  onCompilation: CompilationHandler
  initialState: Partial<FileSystemState>
  actions?: {
    saveRepl?: boolean
  }
}>
export type ReplProps = ParentProps<ReplConfig>

export function Repl(props: ReplProps) {
  const config = mergeProps({ cdn: 'https://esm.sh' }, props)
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

  createEffect(() => {
    const fileSystem = fileSystemResource()
    if (!fileSystem) return
    if (!props.onCompilation) return
  })

  createEffect(() =>
    when(every(fileSystemResource, () => props.onCompilation))(([file, handler]) =>
      file.onCompilation(handler),
    ),
  )

  return (
    <Show when={fileSystemResource()}>
      {fileSystem => (
        <fileSystemContext.Provider value={fileSystem()}>
          <div class={clsx(styles.repl, props.class)}>{config.children}</div>
        </fileSystemContext.Provider>
      )}
    </Show>
  )
}

Repl.Editor = Editor
Repl.Frame = Frame
