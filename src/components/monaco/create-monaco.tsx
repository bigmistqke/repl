import loader, { type Monaco } from '@monaco-editor/loader'
import { wireTmGrammars } from 'monaco-editor-textmate'
import { Registry } from 'monaco-textmate'
import { loadWASM } from 'onigasm'
import onigasm from 'onigasm/lib/onigasm.wasm?url'
import { Accessor, Resource, createEffect, createResource, mapArray } from 'solid-js'
import { unwrap } from 'solid-js/store'
import { CssFile } from 'src/runtime'
import { useRuntime } from 'src/use-runtime'
import { every, whenever } from 'src/utils/conditionals'
import { formatInfo } from 'src/utils/format-log'

const GRAMMARS = new Map([
  ['typescript', 'source.tsx'],
  ['javascript', 'source.tsx'],
  ['css', 'source.css'],
])

export type MonacoTheme = Parameters<Monaco['editor']['defineTheme']>[1]

export function createMonaco(
  config: Accessor<MonacoTheme | Promise<MonacoTheme>>,
): Resource<Monaco> {
  const runtime = useRuntime()
  const [monaco] = createResource(() => loader.init())
  // Load monaco and import all of the repl's resources
  const [resources] = createResource(() =>
    Promise.all([
      import('./text-mate/TypeScriptReact.tmLanguage.json'),
      import('./text-mate/css.tmLanguage.json'),
    ]),
  )
  const [theme] = createResource(config)

  createEffect(
    whenever(every(monaco, theme), ([monaco, theme]) => {
      monaco.editor.defineTheme('current-theme', theme)
      monaco.editor.setTheme('current-theme')
    }),
  )

  // Initialise syntax highlighting
  createEffect(
    whenever(every(monaco, resources), async ([monaco, [tsTextMate, cssTextMate]]) => {
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
    whenever(monaco, monaco => {
      // Initialize typescript-services with empty editor
      monaco.editor
        .create(document.createElement('div'), {
          language: 'typescript',
        })
        .dispose()

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
          ...runtime.config.typescript?.compilerOptions,
          paths: {
            ...runtime.config.typescript?.compilerOptions.paths,
            ...runtime.typeRegistry.alias,
          },
        })

        monaco.languages.typescript.typescriptDefaults.setCompilerOptions(tsCompilerOptions as any)
        monaco.languages.typescript.javascriptDefaults.setCompilerOptions(tsCompilerOptions as any)
      })
    }),
  )

  createEffect(() => {
    const monaco = resources()?.[0]
    if (!runtime.config.debug) return
    if (!monaco) return
    console.info(...formatInfo('monaco loaded', monaco))
  })

  return monaco
}
