import loader, { Monaco } from '@monaco-editor/loader'
import clsx from 'clsx'
import { wireTmGrammars } from 'monaco-editor-textmate'
import { Registry } from 'monaco-textmate'
import { loadWASM } from 'onigasm'
// @ts-expect-error
import onigasm from 'onigasm/lib/onigasm.wasm?url'
import { ComponentProps, Show, createEffect, createResource, splitProps } from 'solid-js'
import { ReplConfig, ReplContext } from 'src/logic/repl-context'
import { deepMerge, every, when } from 'src/utils'
import { ReplEditor } from './editor'
import { ReplFrame } from './frame'
import { ReplTabBar } from './tab-bar'
import vsDark from './themes/vs_dark_good.json'
import vsLight from './themes/vs_light_good.json'
import { ReplContextProvider } from './use-repl'

// @ts-expect-error
import styles from './repl.module.css'

const GRAMMARS = new Map([
  ['typescript', 'source.tsx'],
  ['javascript', 'source.tsx'],
  ['css', 'source.css'],
])

export type ReplProps = ComponentProps<'div'> & ReplConfig

/**
 * Initializes the Repl environment by dynamically loading required libraries (`Babel`, `TypeScript` and `monaco-editor`)
 * and any Babel presets/plugins defined in the props. Configures and instantiates `ReplContext`, which sets up `FileSystem`
 * and `TypeRegistry`. The component ensures no children are rendered until all dependencies are fully loaded and the optional
 * `onSetup`-callback has been completed.
 *
 * It provides access for its children to its internal `ReplContext` through the `useRepl`-hook.
 *
 * @param props Configuration properties for the Repl
 * @returns A JSX element that renders the Repl environment, delaying rendering of child components until all dependencies are loaded.
 */
export function Repl(props: ReplProps) {
  const [, propsWithoutChildren] = splitProps(props, ['children'])
  const [, rest] = splitProps(props, [
    'actions',
    'babel',
    'cdn',
    'children',
    'class',
    'initialState',
    'mode',
    'onSetup',
    'typescript',
  ])
  const config = deepMerge(
    {
      cdn: 'https://esm.sh',
      typescript: {
        allowJs: true,
        allowNonTsExtensions: true,
        esModuleInterop: true,
        allowUmdGlobalAccess: true,
        // enums inlined
        jsx: /* JsxEmit.Preserve as */ 1,
        module: /* ModuleKind.ESNext as */ 99,
        moduleResolution: /* ModuleResolutionKind.Node10 as */ 2,
        target: /* ScriptTarget.ESNext as */ 99,
        paths: {},
      },
    },
    propsWithoutChildren,
  )

  // Import and load all of the repl's resources
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

      const typescriptReactTM = await import('./text-mate/TypeScriptReact.tmLanguage.json')
      const cssTM = await import('./text-mate/css.tmLanguage.json')

      // Initialize textmate-registry
      const registry = new Registry({
        async getGrammarDefinition(scopeName) {
          return {
            format: 'json',
            content: scopeName === 'source.tsx' ? typescriptReactTM.default : cssTM.default,
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
  const [babel] = createResource(() => import('@babel/standalone'))
  const [typescript] = createResource(() => import('typescript'))
  const [babelPresets] = createResource(() =>
    config.babel?.presets
      ? Promise.all(
          config.babel.presets.map(
            async preset => (await import(`${config.cdn}/${preset}`)).default,
          ),
        )
      : [],
  )
  const [babelPlugins] = createResource(() =>
    config.babel?.plugins
      ? Promise.all(
          config.babel.plugins.map(async plugin => {
            if (typeof plugin === 'string') {
              return (await import(`${config.cdn}/${plugin}`)).default
            }
            return plugin
          }),
        )
      : [],
  )

  // Once all resources are loaded, instantiate and initialize ReplContext
  const [repl] = createResource(
    every(monaco, babel, typescript, babelPlugins, babelPresets),
    async ([monaco, babel, typescript, babelPlugins, babelPresets]) => {
      const repl = new ReplContext(
        { monaco, typescript, babel, babelPlugins, babelPresets },
        config,
      )
      await config.onSetup?.(repl)
      repl.initialize()
      return repl
    },
  )

  // Switch light/dark mode of monaco-editor
  createEffect(() =>
    when(repl)(repl => {
      repl.libs.monaco.editor.setTheme(props.mode === 'light' ? 'vs-light-plus' : 'vs-dark-plus')
    }),
  )

  return (
    <Show when={repl()}>
      {repl => (
        <ReplContextProvider value={repl()}>
          <div class={clsx(styles.repl, props.class)} {...rest}>
            {props.children}
          </div>
        </ReplContextProvider>
      )}
    </Show>
  )
}

/**
 * `Repl.Editor` embeds a `monaco-editor` instance for editing files.
 * It dynamically creates and binds a `monaco`-model and `File`
 * in the virtual `FileSystem` based on the provided `path`-prop.
 *
 * @param  props - The properties passed to the editor component.
 * @returns The container div element that hosts the Monaco editor.
 */
Repl.Editor = ReplEditor
/**
 * `Repl.Frame` encapsulates an iframe element to provide an isolated execution
 * environment within the application. It is used to inject and execute CSS or JS module separately
 * from the main document flow.
 *
 * @param props - The props for configuring the iframe.
 * @returns The iframe element configured according to the specified props.
 *
 * @example
 * // To create an iframe with specific styles and a unique name:
 * <ReplFrame name="myCustomFrame" bodyStyle={{ backgroundColor: 'red' }} />
 */
Repl.Frame = ReplFrame
/**
 * `Repl.TabBar` is a utility-component to filter and sort `File` of the virtual `FileSystem`.
 * This can be used to create a tab-bar to navigate between different files. It accepts an optional
 * prop of paths to sort and filter the files. If not provided it will display all existing files,
 * excluding files in the `node_modules` directory: This directory contains packages imported with
 * `FileSystem.importFromPackageJson()` and auto-imported types of external dependencies.
 *
 * @param props - The properties passed to the tab bar component.
 * @returns  The container div element that hosts the tabs for each file.
 */
Repl.TabBar = ReplTabBar
