import { Runtime } from '@bigmistqke/repl'
import { MonacoTheme } from '@bigmistqke/repl/editor/monaco'
import { useRuntime } from '@bigmistqke/repl/element/runtime'
import { Element, element, ElementAttributes, stringAttribute } from '@lume/element'
import { type Monaco } from '@monaco-editor/loader'
import { signal } from 'classy-solid'
import { wireTmGrammars } from 'monaco-editor-textmate'
import { Registry } from 'monaco-textmate'
import { loadWASM } from 'onigasm'
import onigasm from 'onigasm/lib/onigasm.wasm?url'
import { createEffect, createMemo, createResource, mapArray, onCleanup, untrack } from 'solid-js'
import { unwrap } from 'solid-js/store'
import { every, when, whenEffect } from 'src/utils/conditionals'

/**********************************************************************************/
/*                                                                                */
/*                                      Types                                     */
/*                                                                                */
/**********************************************************************************/

type ReplMonacoAttributes = ElementAttributes<
  ReplMonacoEditor,
  'path' | 'theme' | 'runtime' | 'monaco'
>

declare module 'solid-js/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      'repl-monaco-editor': ReplMonacoAttributes
    }
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'repl-monaco-editor': ReplMonacoAttributes
    }
  }
}

/**********************************************************************************/
/*                                                                                */
/*                               Repl Monaco Editor                               */
/*                                                                                */
/**********************************************************************************/

function prefixPaths(
  paths?: Record<string, string[] | string>,
): Record<string, string[]> | undefined {
  if (!paths) {
    return undefined
  }
  return Object.fromEntries(
    Object.entries(paths).map(([key, paths]) => [
      key,
      (Array.isArray(paths) ? paths : [paths]).map(path => `file:///${path}`),
    ]),
  )
}

@element('repl-monaco-editor')
export class ReplMonacoEditor extends Element {
  static monaco: Promise<Monaco> | undefined
  @signal monaco: Promise<Monaco> | undefined
  @signal runtime: Runtime | null | undefined = null
  @stringAttribute path = ''
  @stringAttribute theme: MonacoTheme | null = null

  static GRAMMAR_MAP = {
    typescript: 'source.tsx',
    javascript: 'source.tsx',
    css: 'source.css',
  }

  hasShadow = false

  css = /* css */ `
    :host {
      display: block;
      & .root {
        height: 100%;
      }
    }
  `

  template = () => {
    const runtime = useRuntime(this)
    const [monaco] = createResource(() => this.monaco || ReplMonacoEditor.monaco)

    // Setup monaco.
    {
      // TODO:  Swap theme with TM-CDN class we can share with tm-editor.
      const [grammars] = createResource(() =>
        Promise.all([
          import('./text-mate/TypeScriptReact.tmLanguage.json').then(module => module.default),
          import('./text-mate/css.tmLanguage.json').then(module => module.default),
        ]),
      )
      const [theme] = createResource(() => this.theme)

      whenEffect(monaco, monaco => {
        // Initialize typescript-services with empty editor.
        monaco.editor
          .create((<div />) as HTMLDivElement, {
            language: 'typescript',
          })
          .dispose()

        // TODO:  Swap theme with TM-CDN class we can share with tm-editor.
        whenEffect(theme, theme => {
          monaco.editor.defineTheme('current-theme', theme)
          monaco.editor.setTheme('current-theme')
        })

        // Initialise textmate-grammars.
        whenEffect(grammars, async ([tsGrammar, cssGrammar]) => {
          // Initialise textmate-registry.
          const registry = new Registry({
            async getGrammarDefinition(scopeName) {
              return {
                format: 'json',
                // TODO:  figure out a more modular/customisable way of how to choose textmate-grammar.
                content: scopeName === 'source.tsx' ? tsGrammar : cssGrammar,
              }
            },
          })

          // Load onigasm's wasm when the language-configuration is set.
          const { setLanguageConfiguration } = monaco.languages
          monaco.languages.setLanguageConfiguration = (languageId, configuration) => {
            initialiseOnigasm()
            return setLanguageConfiguration(languageId, configuration)
          }

          let initialisation: null | Promise<any> | 'complete' = null
          async function initialiseOnigasm(): Promise<void> {
            if (!initialisation)
              initialisation = loadWASM(onigasm).then(() => (initialisation = 'complete'))
            await initialisation
            await wireTmGrammars(
              monaco,
              registry,
              new Map(Object.entries(ReplMonacoEditor.GRAMMAR_MAP)),
            )
          }
        })

        // Sync all Monaco-models with the sources of the virtual FileSystem.
        whenEffect(runtime, runtime => {
          createEffect(
            mapArray(
              () => Object.values(runtime.fs.all()),
              file => {
                const uri = monaco.Uri.parse(`file:///${file.path}`)

                const model =
                  monaco.editor.getModel(uri) ||
                  monaco.editor.createModel(file.source, file.getType(), uri)

                createEffect(() => {
                  if (model.getValue() !== file.get()) {
                    model.setValue(file.get())
                  }
                })
              },
            ),
          )

          // Sync monaco-editor's virtual file-system with type-registry's sources.
          createEffect(
            mapArray(
              () => Object.keys(runtime.types.sources),
              virtualPath => {
                whenEffect(
                  () => runtime.types.sources[virtualPath],
                  source =>
                    monaco.languages.typescript.typescriptDefaults.addExtraLib(
                      source,
                      `file:///node_modules/${virtualPath}`,
                    ),
                )
              },
            ),
          )

          // Add virtual path to monaco's tsconfig's `path`-property.
          createEffect(() => {
            const runtimeTsConfig = runtime.config.tsconfig
            const tsConfig = unwrap({
              ...runtimeTsConfig,
              paths: {
                ...prefixPaths(runtimeTsConfig?.paths),
                ...runtime.types.alias,
                ...prefixPaths(runtime.fs.alias),
              },
            }) as any
            monaco.languages.typescript.typescriptDefaults.setCompilerOptions(tsConfig)
            monaco.languages.typescript.javascriptDefaults.setCompilerOptions(tsConfig)
          })
        })
      })
    }

    return (
      <div
        class="root"
        ref={container => {
          // Initialize Monaco-editor.
          whenEffect(every(monaco, runtime), ([monaco, runtime]) => {
            const editor = createMemo(() => {
              const editor = monaco.editor.create(container, {
                value: '',
                language: 'typescript',
                automaticLayout: true,
              })
              onCleanup(() => editor.dispose())
              return editor
            })

            // Get or create file.
            const file = createMemo(() => runtime.fs.get(this.path) || runtime.fs.create(this.path))

            const model = createMemo(
              when(file, file => {
                const uri = monaco.Uri.parse(`file:///${this.path}`)
                return (
                  monaco.editor.getModel(uri) ||
                  monaco.editor.createModel(
                    untrack(() => file.source),
                    file.getType(),
                    uri,
                  )
                )
              }),
            )

            // Link model with file in file-system.
            whenEffect(every(editor, file, model), ([editor, file, model]) => {
              // Update monaco-editor's model to current file's model.
              editor.setModel(model)
              // Update the file when the model changes content.
              model.onDidChangeContent(() => file.set(model.getValue()))
            })
          })
        }}
      />
    )
  }
}
