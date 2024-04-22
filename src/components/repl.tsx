import loader, { Monaco } from '@monaco-editor/loader'
import clsx from 'clsx'
import { ParentProps, Show, createResource, mergeProps } from 'solid-js'
import { JsxEmit, ModuleKind, ModuleResolutionKind, ScriptTarget } from 'typescript'

import { FileSystem, FileSystemState } from '../logic/file-system'
import { Frames } from '../logic/frames'
import { Editor } from './editor'
import { Frame } from './frame'
import { Panel } from './panel'
import { TabBar } from './tab-bar'
import { replContext } from './use-repl'

import styles from './repl.module.css'

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
  onReady: (event: { fs: FileSystem; frames: Frames }) => void
  initialState: Partial<FileSystemState>
  actions?: {
    saveRepl?: boolean
  }
}>
export type ReplProps = ParentProps<ReplConfig>

export function Repl(props: ReplProps) {
  const config = mergeProps({ cdn: 'https://esm.sh' }, props)
  const frames = new Frames()

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

  const [monacoResource] = createResource(async () => {
    const monaco = await (loader.init() as Promise<Monaco>)
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions(typescript())

    {
      // initialize typescript-services with empty editor
      const editor = monaco.editor.create(document.createElement('div'), {
        language: 'typescript',
      })
      editor.dispose()
    }
    const typescriptWorker = await monaco.languages.typescript.getTypeScriptWorker()

    return { monaco, typescriptWorker }
  })

  const [fileSystemResource] = createResource(
    monacoResource,
    async ({ monaco, typescriptWorker }) => {
      try {
        const fs = new FileSystem(monaco, typescriptWorker, config)
        config.onReady?.({ fs, frames })
        return fs
      } catch (error) {
        console.log('error', error)
        throw error
      }
    },
  )

  return (
    <Show when={fileSystemResource()}>
      {fs => (
        <replContext.Provider value={{ fs: fs(), frames }}>
          <div class={clsx(styles.repl, props.class)}>{config.children}</div>
        </replContext.Provider>
      )}
    </Show>
  )
}

Repl.Editor = Editor
Repl.Frame = Frame
Repl.TabBar = TabBar
Repl.Panel = Panel
