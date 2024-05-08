import loader, { Monaco } from '@monaco-editor/loader'
import { wireTmGrammars } from 'monaco-editor-textmate'
import { Registry } from 'monaco-textmate'
import { loadWASM } from 'onigasm'
import { useRuntime } from 'src'
import { CssFile } from 'src/runtime'
// @ts-expect-error
import onigasm from 'onigasm/lib/onigasm.wasm?url'
import {
  ParentProps,
  Show,
  Suspense,
  createContext,
  createEffect,
  createResource,
  mapArray,
  useContext,
} from 'solid-js'
import { unwrap } from 'solid-js/store'
import { whenever } from 'src/utils/conditionals'

const GRAMMARS = new Map([
  ['typescript', 'source.tsx'],
  ['javascript', 'source.tsx'],
  ['css', 'source.css'],
])

const monacoContext = createContext<Monaco>()
export const useMonaco = (): Monaco => {
  const context = useContext(monacoContext)
  if (!context) throw 'context should be used in descendant of MonacoProvider'
  return context
}

export function ReplMonacoProvider(props: ParentProps) {
  const runtime = useRuntime()
  // Load monaco and import all of the repl's resources
  const [resources] = createResource(() =>
    Promise.all([
      loader.init(),
      import('./themes/vs_dark_good.json'),
      import('./themes/vs_light_good.json'),
      import('./text-mate/TypeScriptReact.tmLanguage.json'),
      import('./text-mate/css.tmLanguage.json'),
    ]),
  )

  // Initialise syntax highlighting
  createEffect(
    whenever(resources, async ([monaco, vsDarkTheme, vsLightTheme, tsTextMate, cssTextMate]) => {
      // Monaco's built-in themes aren't powereful enough to handle text-mate tokens
      // https://github.com/Nishkalkashyap/monaco-vscode-textmate-theme-converter#monaco-vscode-textmate-theme-converter
      monaco.editor.defineTheme('vs-dark-plus', vsDarkTheme as any)
      monaco.editor.defineTheme('vs-light-plus', vsLightTheme as any)

      // Initialise text-mate registry
      const registry = new Registry({
        async getGrammarDefinition(scopeName) {
          return {
            format: 'json',
            content: scopeName === 'source.tsx' ? tsTextMate.default : cssTextMate.default,
          }
        },
      })

      // Load text-mate grammars
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
    }),
  )

  createEffect(
    whenever(resources, ([monaco]) => {
      // Initialize typescript-services with empty editor
      monaco.editor
        .create(document.createElement('div'), {
          language: 'typescript',
        })
        .dispose()

      // Set light/dark-mode of monaco-editor
      createEffect(() =>
        monaco.editor.setTheme(runtime.config.mode === 'light' ? 'vs-light-plus' : 'vs-dark-plus'),
      )

      // Initialize models for all Files in FileSystem
      Object.entries(runtime.fileSystem.all()).forEach(([path, value]) => {
        const uri = monaco.Uri.parse(`file:///${path}`)
        if (!monaco.editor.getModel(uri)) {
          const type = value instanceof CssFile ? 'css' : 'typescript'
          monaco.editor.createModel('', type, uri)
        }
      })

      // Sync monaco-editor's virtual file-system with type-registry's sources
      createEffect(
        mapArray(
          () => Object.keys(runtime.typeRegistry.sources),
          virtualPath => {
            createEffect(
              whenever(
                () => runtime.typeRegistry.sources[virtualPath],
                source =>
                  monaco.languages.typescript.typescriptDefaults.addExtraLib(
                    source,
                    `file:///node_modules/${virtualPath}`,
                  ),
              ),
            )
          },
        ),
      )

      // Sync monaco-editor's tsconfig with repl's typescript-prop and type-registry's alias-property.
      createEffect(() => {
        // add virtual path to monaco's tsconfig's `path`-property
        const tsCompilerOptions = unwrap({
          ...runtime.config.typescript,
          paths: {
            ...runtime.config.typescript?.paths,
            ...runtime.typeRegistry.alias,
          },
        })

        monaco.languages.typescript.typescriptDefaults.setCompilerOptions(tsCompilerOptions)
        monaco.languages.typescript.javascriptDefaults.setCompilerOptions(tsCompilerOptions)
      })
    }),
  )

  return (
    <Suspense>
      <Show when={resources()} keyed>
        {([monaco]) => (
          <monacoContext.Provider value={monaco}>{props.children}</monacoContext.Provider>
        )}
      </Show>
    </Suspense>
  )
}
