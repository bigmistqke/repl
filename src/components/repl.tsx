import loader, { Monaco } from '@monaco-editor/loader'
import clsx from 'clsx'
import { wireTmGrammars } from 'monaco-editor-textmate'
import { Registry } from 'monaco-textmate'
import { loadWASM } from 'onigasm'
// @ts-expect-error
import onigasm from 'onigasm/lib/onigasm.wasm?url'
import { ParentProps, Show, createEffect, createResource, splitProps } from 'solid-js'
import { JsxEmit, ModuleKind, ModuleResolutionKind, ScriptTarget } from 'typescript'

import { deepMerge } from 'src/utils'
import { FileSystem, FileSystemState } from '../logic/file-system'
import { FrameRegistry } from '../logic/frame-registry'
import { ReplEditor } from './editor'
import { ReplFrame } from './frame'
import { ReplTabBar } from './tab-bar'
import typescriptReactTM from './text-mate/TypeScriptReact.tmLanguage.json'
import cssTM from './text-mate/css.tmLanguage.json'
import vsDark from './themes/vs_dark_good.json'
import vsLight from './themes/vs_light_good.json'
import { replContext } from './use-repl'

// @ts-expect-error
import styles from './repl.module.css'

const GRAMMARS = new Map([
  ['typescript', 'source.tsx'],
  ['javascript', 'source.tsx'],
  ['css', 'source.css'],
])

export type TypescriptConfig = Parameters<
  Monaco['languages']['typescript']['typescriptDefaults']['setCompilerOptions']
>[0]
export type BabelConfig = Partial<{ presets: string[]; plugins: (string | babel.PluginItem)[] }>
export type ReplConfig = Partial<{
  babel: BabelConfig
  cdn: string
  class: string
  initialState: Partial<FileSystemState>
  mode: 'light' | 'dark'
  onReady: (event: { fs: FileSystem; frames: FrameRegistry }) => Promise<void> | void
  packages: string[]
  typescript: TypescriptConfig
  actions?: {
    saveRepl?: boolean
  }
}>
export type ReplProps = ParentProps<ReplConfig>

export function Repl(props: ReplProps) {
  const [, rest] = splitProps(props, ['children'])
  const config = deepMerge(
    {
      cdn: 'https://esm.sh',
      typescript: {
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
    },
    rest,
  )
  const frames = new FrameRegistry()

  const [monaco] = createResource(async () => {
    const monaco = await (loader.init() as Promise<Monaco>)
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions(config.typescript)

    {
      // Initialize typescript-services with empty editor
      const editor = monaco.editor.create(document.createElement('div'), {
        language: 'typescript',
      })
      editor.dispose()
    }

    {
      // Syntax highlighting

      // Monaco's built-in themes aren't powereful enough to handle TM tokens
      // https://github.com/Nishkalkashyap/monaco-vscode-textmate-theme-converter#monaco-vscode-textmate-theme-converter
      monaco.editor.defineTheme('vs-dark-plus', vsDark as any)
      monaco.editor.defineTheme('vs-light-plus', vsLight as any)

      // Switch light/dark mode of monaco-editor
      createEffect(() => {
        monaco.editor.setTheme(props.mode === 'light' ? 'vs-light-plus' : 'vs-dark-plus')
      })

      // Initialize textmate-registry
      const registry = new Registry({
        async getGrammarDefinition(scopeName) {
          return {
            format: 'json',
            content: scopeName === 'source.tsx' ? typescriptReactTM : cssTM,
          }
        },
      })

      // Load onigasm
      let hasLoadedOnigasm: boolean | Promise<void> = false
      const setLanguageConfiguration = monaco.languages.setLanguageConfiguration
      monaco.languages.setLanguageConfiguration = (languageId, configuration) => {
        initialiseGrammars()
        return setLanguageConfiguration(languageId, configuration)
      }
      async function initialiseGrammars(): Promise<void> {
        if (!hasLoadedOnigasm) hasLoadedOnigasm = loadWASM(onigasm)
        if (hasLoadedOnigasm instanceof Promise) await hasLoadedOnigasm
        hasLoadedOnigasm = true
        await wireTmGrammars(monaco, registry, GRAMMARS)
      }
    }

    return monaco
  })

  const [fs] = createResource(monaco, async monaco => {
    const fs = new FileSystem(monaco, config)
    await config.onReady?.({ fs, frames })
    return fs
  })

  return (
    <Show when={fs()}>
      {fs => (
        <replContext.Provider value={{ fs: fs(), frames }}>
          <div class={clsx(styles.repl, props.class)}>{props.children}</div>
        </replContext.Provider>
      )}
    </Show>
  )
}

Repl.Editor = ReplEditor
Repl.Frame = ReplFrame
Repl.TabBar = ReplTabBar
