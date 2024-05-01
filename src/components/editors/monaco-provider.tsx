import loader, { Monaco } from '@monaco-editor/loader'
import { wireTmGrammars } from 'monaco-editor-textmate'
import { Registry } from 'monaco-textmate'
import { loadWASM } from 'onigasm'
// @ts-expect-error
import onigasm from 'onigasm/lib/onigasm.wasm?url'
import { ParentProps, Show, createContext, createResource, useContext } from 'solid-js'
import { useRepl } from '../use-repl'

const GRAMMARS = new Map([
  ['typescript', 'source.tsx'],
  ['javascript', 'source.tsx'],
  ['css', 'source.css'],
])

const monacoContext = createContext<Monaco>()
export const useMonaco = () => {
  const context = useContext(monacoContext)
  if (!context) throw 'context should be used in descendant of MonacoProvider'
  return context
}

export function ReplMonacoProvider(props: ParentProps) {
  const repl = useRepl()
  // Import and load all of the repl's resources
  const [monaco] = createResource(async () => {
    const monaco = await (loader.init() as Promise<Monaco>)
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions(repl.config.typescript || {})
    // Initialize typescript-services with empty editor
    {
      const editor = monaco.editor.create(document.createElement('div'), {
        language: 'typescript',
      })
      editor.dispose()
    }
    // Syntax highlighting
    {
      const vsDark = await import('./themes/vs_dark_good.json')
      const vsLight = await import('./themes/vs_light_good.json')
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

  return (
    <Show when={monaco()}>
      <monacoContext.Provider value={monaco()}>{props.children}</monacoContext.Provider>
    </Show>
  )
}
