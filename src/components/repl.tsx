import loader, { Monaco } from '@monaco-editor/loader'
import clsx from 'clsx'
import { wireTmGrammars } from 'monaco-editor-textmate'
import { Registry } from 'monaco-textmate'
import { loadWASM } from 'onigasm'
// @ts-expect-error
import onigasm from 'onigasm/lib/onigasm.wasm?url'
import { ComponentProps, Show, createEffect, createResource, splitProps } from 'solid-js'
import { JsxEmit, ModuleKind, ModuleResolutionKind, ScriptTarget } from 'typescript'

import { deepMerge, when } from 'src/utils'
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
  /** Configuration options for Babel, used for code transformation. */
  babel: BabelConfig
  /** The CDN URL used to load TypeScript and other external libraries. */
  cdn: string
  /** CSS class for styling the root REPL component. */
  class: string
  /** Initial state of the virtual file system to preload files. */
  initialState: Partial<FileSystemState>
  /** Theme setting for the Monaco editor. */
  mode: 'light' | 'dark'
  /** Callback function that runs after initializing the editor and file system. */
  onSetup: (event: { fs: FileSystem; frames: FrameRegistry }) => Promise<void> | void
  /** TypeScript compiler options for the Monaco editor. */
  typescript: TypescriptConfig
  /** Optional actions like saving the current state of the REPL. */
  actions?: {
    saveRepl?: boolean
  }
}>

export type ReplProps = ComponentProps<'div'> & ReplConfig

/**
 * The `Repl` component serves as the root of your application's REPL environment. It initializes `monaco-editor`,
 * sets up the virtual `FileSystem`, and provides a context that is accessible to all descendant components with `useRepl`.
 * This component merges user-specified configuration with defaults to setup the editor environment, handle theming, and manage file
 * operations interactively.
 *
 * @param {ReplProps} props - The properties passed to configure the REPL environment.
 * @returns {JSX.Element} A JSX element that renders the REPL environment including the editor and any children components.
 */
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

    // Initialize typescript-services with empty editor
    {
      const editor = monaco.editor.create(document.createElement('div'), {
        language: 'typescript',
      })
      editor.dispose()
    }

    // Syntax highlighting
    {
      // Monaco's built-in themes aren't powereful enough to handle TM tokens
      // https://github.com/Nishkalkashyap/monaco-vscode-textmate-theme-converter#monaco-vscode-textmate-theme-converter
      monaco.editor.defineTheme('vs-dark-plus', vsDark as any)
      monaco.editor.defineTheme('vs-light-plus', vsLight as any)

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

  createEffect(() =>
    when(monaco)(monaco => {
      // Switch light/dark mode of monaco-editor
      monaco.editor.setTheme(props.mode === 'light' ? 'vs-light-plus' : 'vs-dark-plus')
    }),
  )

  const [fs] = createResource(monaco, async monaco => {
    const fs = new FileSystem(monaco, config)
    await config.onSetup?.({ fs, frames })
    fs.initialize()
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

/**
 * `Repl.Editor` is a SolidJS component that embeds a Monaco Editor instance for editing files within a virtual file system.
 * It dynamically creates an editor instance, manages its lifecycle, and binds it to a specific file based on the provided path.
 * The component also integrates custom actions such as saving the file, updating the editor's model, and cleaning up on unmount.
 *
 * @param {EditorProps} props - The properties passed to the editor component.
 * @returns {HTMLDivElement} The container div element that hosts the Monaco editor.
 *
 * @typedef {Object} EditorProps
 * @property {string} path - The path to the file that the editor should open and display.
 * @property {Function} [onMount] - Optional callback that is called when the editor is mounted. It receives the created MonacoEditor instance.
 */
Repl.Editor = ReplEditor
/**
 * `Repl.Frame` is a component that encapsulates an iframe element to provide an isolated execution
 * environment within the application. It is used to execute or render content separately from the main
 * document flow. The component automatically handles the lifecycle of the iframe, ensuring that it
 * integrates seamlessly with the application's state management.
 *
 * @param {FrameProps} props - The props for configuring the iframe.
 * @returns {JSX.Element} The iframe element configured according to the specified props.
 *
 * @typedef {Object} FrameProps
 * @property {string} [name='default'] - The unique identifier for the iframe, which is used to manage its
 * presence in the global frame registry. If not specified, 'default' is used as a fallback.
 * @property {JSX.CSSProperties | string | undefined} bodyStyle - Optional CSS properties or a string
 * that defines the style of the iframe's body. This allows for dynamic styling of the content within
 * the iframe.
 *
 * @example
 * // To create an iframe with specific styles and a unique name:
 * <ReplFrame name="myCustomFrame" bodyStyle={{ backgroundColor: 'red' }} />
 */
Repl.Frame = ReplFrame
/**
 * `Repl.TabBar` is a SolidJS component designed to render a navigation bar with tabs that represent open files
 * within a virtual file system. It dynamically creates tabs based on the files present in the system or a subset
 * specified by the `files` prop. Each tab can be customized using the `children` render prop.
 *
 * @param {ReplTabBarProps} props - The properties passed to the tab bar component.
 * @returns {JSXElement} The container div element that hosts the tabs for each file.
 *
 * @typedef {Object} ReplTabBarProps
 * @property {string[]} [files] - Optional array of file paths to specifically include in the tab bar. If not provided,
 *                                all files from the file system are used.
 * @property {Function} children - A render prop function that receives an object with the current path and file object.
 *                                 It should return a JSX element to render for each tab.
 */
Repl.TabBar = ReplTabBar
