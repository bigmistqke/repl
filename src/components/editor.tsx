import loader, { Monaco } from '@monaco-editor/loader'
import { wireTmGrammars } from 'monaco-editor-textmate'
import { Registry } from 'monaco-textmate'
import { loadWASM } from 'onigasm'
// @ts-expect-error
import onigasm from 'onigasm/lib/onigasm.wasm?url'
import { ComponentProps, createResource, splitProps } from 'solid-js'
import { every, when } from 'src/utils'
import vsDark from './themes/vs_dark_good.json'
import vsLight from './themes/vs_light_good.json'

// @ts-expect-error
import { createEffect, createMemo, mapArray, onCleanup, untrack } from 'solid-js'

const GRAMMARS = new Map([
  ['typescript', 'source.tsx'],
  ['javascript', 'source.tsx'],
  ['css', 'source.css'],
])

import { CssFile } from '..'
import { useRepl } from './use-repl'

type MonacoEditor = ReturnType<Monaco['editor']['create']>

export type EditorProps = Omit<ComponentProps<'div'>, 'ref'> & {
  /**
   * The path to the file that the editor should open and display.
   * This is used to retrieve or create the file in the virtual file system.
   */
  path: string
  /**
   * Optional callback that is executed when the editor is fully mounted.
   * @param editor
   * @returns
   */
  onMount?: (editor: MonacoEditor) => void
}

export function ReplEditor(props: EditorProps) {
  const [, rest] = splitProps(props, ['class'])
  const repl = useRepl()

  console.log('repleditor mounted')

  // Import and load all of the repl's resources
  const [monaco] = createResource(async () => {
    const monaco = await (loader.init() as Promise<Monaco>)
    console.log('initialize monaco!')
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
      // Monaco's built-in themes aren't powereful enough to handle TM tokens
      // https://github.com/Nishkalkashyap/monaco-vscode-textmate-theme-converter#monaco-vscode-textmate-theme-converter
      monaco.editor.defineTheme('vs-dark-plus', vsDark as any)
      monaco.editor.defineTheme('vs-light-plus', vsLight as any)

      const typescriptReactTM = await import('./text-mate/TypeScriptReact.tmLanguage.json')
      const cssTM = await import('./text-mate/css.tmLanguage.json')

      console.log('this happens?')

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

    console.log('return monaco!')

    return monaco
  })

  // Initialize html-element of monaco-editor
  const container = (<div class={props.class} {...rest} />) as HTMLDivElement

  const [editor] = createResource(monaco, monaco => {
    console.log('monaco!')
    // Create monaco-editor
    return monaco.editor.create(container, {
      value: '',
      language: 'typescript',
      automaticLayout: true,
    })
  })

  // Get or create file
  const file = createMemo(
    () => repl.fileSystem.get(props.path) || repl.fileSystem.create(props.path),
  )

  const model = createMemo(() =>
    when(every(file, monaco), ([file, monaco]) => {
      const uri = monaco.Uri.parse(`file:///${file.path}`)
      const source = untrack(() => file.get())
      const type = file instanceof CssFile ? 'css' : 'typescript'
      return monaco.editor.getModel(uri) || monaco.editor.createModel(source || '', type, uri)
    }),
  )

  createEffect(() =>
    when(every(monaco, editor), ([monaco, editor]) => {
      // Call onMount-prop
      props.onMount?.(editor)

      // Initialize models for all Files in FileSystem
      Object.entries(repl.fileSystem.all()).forEach(([path, value]) => {
        const uri = monaco.Uri.parse(`file:///${path}`)
        if (!monaco.editor.getModel(uri)) {
          const type = value instanceof CssFile ? 'css' : 'typescript'
          monaco.editor.createModel('', type, uri)
        }
      })

      createEffect(() =>
        monaco.editor.setTheme(props.mode === 'light' ? 'vs-light-plus' : 'vs-dark-plus'),
      )

      createEffect(() =>
        when(model, model => {
          // Update monaco-editor's model to current file's model
          editor.setModel(model)
          // Set the value
          model.setValue(file().get())
          // Update the file when the model changes content
          model.onDidChangeContent(() => file().set(model.getValue()))
          // Add action to context-menu of monaco-editor
          createEffect(() => {
            if (repl.config.actions?.saveRepl === false) return
            const cleanup = editor.addAction({
              id: 'save-repl',
              label: 'Save Repl',
              keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY], // Optional: set a keybinding
              precondition: undefined,
              keybindingContext: undefined,
              contextMenuGroupId: 'repl',
              run: () => repl.download(),
            })
            onCleanup(() => cleanup.dispose())
          })
        }),
      )

      createEffect(
        mapArray(
          () => Object.keys(repl.typeRegistry.alias),
          key => {
            // add virtual path to monaco's tsconfig's `path`-property
            const tsCompilerOptions = {
              ...repl.config.typescript,
              paths: { ...repl.typeRegistry.alias, [key]: repl.typeRegistry.alias[key]! },
            }
            monaco.languages.typescript.typescriptDefaults.setCompilerOptions(tsCompilerOptions)
            monaco.languages.typescript.javascriptDefaults.setCompilerOptions(tsCompilerOptions)
          },
        ),
      )

      createEffect(
        mapArray(
          () => Object.keys(repl.typeRegistry.sources),
          virtualPath => {
            createEffect(() => {
              monaco.languages.typescript.typescriptDefaults.addExtraLib(
                repl.typeRegistry.sources[virtualPath]!,
                virtualPath,
              )
            })
          },
        ),
      )

      // Dispose monaco-editor after cleanup
      onCleanup(() => editor.dispose())
    }),
  )

  return container
}
