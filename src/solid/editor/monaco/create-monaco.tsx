import { CssFile, Runtime } from '@bigmistqke/repl/runtime'
import { type Monaco } from '@monaco-editor/loader'
import { wireTmGrammars } from 'monaco-editor-textmate'
import { Registry } from 'monaco-textmate'
import { loadWASM } from 'onigasm'
import onigasm from 'onigasm/lib/onigasm.wasm?url'
import { Resource, createEffect, createResource, mapArray } from 'solid-js'
import { unwrap } from 'solid-js/store'
import { every, whenever } from 'src/utils/conditionals'
import { formatInfo } from 'src/utils/format-log'
import ts from 'typescript'

const GRAMMARS = new Map([
  ['typescript', 'source.tsx'],
  ['javascript', 'source.tsx'],
  ['css', 'source.css'],
])

export type MonacoTheme = Parameters<Monaco['editor']['defineTheme']>[1]

export function createMonaco(props: {
  tsconfig?: ts.CompilerOptions
  theme?: MonacoTheme | Promise<MonacoTheme>
  monaco: Promise<Monaco> | Monaco
  runtime: Runtime
}): Resource<Monaco> {
  const [monaco] = createResource(() => props.monaco)

  // Load monaco and import all of the repl's resources
  const [resources] = createResource(() =>
    Promise.all([
      import('./text-mate/TypeScriptReact.tmLanguage.json'),
      import('./text-mate/css.tmLanguage.json'),
    ]),
  )
  const [theme] = createResource(() => props.theme)

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
      createEffect(
        mapArray(
          () => Object.values(props.runtime.fileSystem.all()),
          file => {
            // Initialize models for all Files in FileSystem
            // Object.entries(runtime.fileSystem.all()).forEach(([path, value]) => {
            const uri = monaco.Uri.parse(`file:///${file.path}`)

            const model =
              monaco.editor.getModel(uri) ||
              monaco.editor.createModel(
                file.get(),
                file instanceof CssFile ? 'css' : 'typescript',
                uri,
              )

            createEffect(() => {
              if (model.getValue() !== file.get()) {
                model.setValue(file.get())
              }
            })
          },
        ),
      )

      // Initialize typescript-services with empty editor
      monaco.editor
        .create(document.createElement('div'), {
          language: 'typescript',
        })
        .dispose()

      // Sync monaco-editor's virtual file-system with type-registry's sources
      createEffect(
        mapArray(
          () => Object.keys(props.runtime.typeRegistry.sources),
          virtualPath => {
            createEffect(
              whenever(
                () => props.runtime.typeRegistry.sources[virtualPath],
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

      function wrapPaths(paths: Record<string, string[] | string>): Record<string, string[]> {
        return Object.fromEntries(
          Object.entries(paths).map(([key, paths]) => [
            key,
            (Array.isArray(paths) ? paths : [paths]).map(path => `file:///${path}`),
          ]),
        )
      }

      // Sync monaco-editor's tsconfig with repl's typescript-prop and type-registry's alias-property.
      createEffect(() => {
        console.log(props?.tsconfig)
        // add virtual path to monaco's tsconfig's `path`-property
        const tsCompilerOptions = unwrap({
          ...props?.tsconfig,
          paths: {
            ...(props?.tsconfig?.paths ? wrapPaths(props.tsconfig.paths) : undefined),
            ...props.runtime.typeRegistry.alias,
            ...(props.runtime.fileSystem.alias
              ? wrapPaths(props.runtime.fileSystem.alias)
              : undefined),
          },
        })

        monaco.languages.typescript.typescriptDefaults.setCompilerOptions(tsCompilerOptions as any)
        monaco.languages.typescript.javascriptDefaults.setCompilerOptions(tsCompilerOptions as any)
      })
    }),
  )

  createEffect(() => {
    const monaco = resources()?.[0]
    if (!props.runtime.config.debug) return
    if (!monaco) return
    console.info(...formatInfo('monaco loaded', monaco))
  })

  return monaco
}
