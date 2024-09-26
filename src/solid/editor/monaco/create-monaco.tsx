import { CssFile, Runtime } from '@bigmistqke/repl'
import { type Monaco } from '@monaco-editor/loader'
import { wireTmGrammars } from 'monaco-editor-textmate'
import { Registry } from 'monaco-textmate'
import { loadWASM } from 'onigasm'
import onigasm from 'onigasm/lib/onigasm.wasm?url'
import { Resource, createEffect, createResource, mapArray } from 'solid-js'
import { unwrap } from 'solid-js/store'
import { every, whenEffect } from 'src/utils/conditionals'
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

  whenEffect(every(monaco, theme), ([monaco, theme]) => {
    monaco.editor.defineTheme('current-theme', theme)
    monaco.editor.setTheme('current-theme')
  })

  // Initialise syntax highlighting
  whenEffect(every(monaco, resources), async ([monaco, [tsTextMate, cssTextMate]]) => {
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
  })

  whenEffect(monaco, monaco => {
    createEffect(
      mapArray(
        () => Object.values(props.runtime.fs.all()),
        file => {
          // Initialize models for all Files in FileSystem
          // Object.entries(runtime.fileSystem.all()).forEach(([path, value]) => {
          const uri = monaco.Uri.parse(`file:///${file.path}`)

          const model =
            monaco.editor.getModel(uri) ||
            monaco.editor.createModel(
              file.source,
              file instanceof CssFile ? 'css' : 'typescript',
              uri,
            )

          createEffect(() => {
            if (model.getValue() !== file.source) {
              model.setValue(file.source)
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
        () => Object.keys(props.runtime.types.sources),
        virtualPath => {
          whenEffect(
            () => props.runtime.types.sources[virtualPath],
            source =>
              monaco.languages.typescript.typescriptDefaults.addExtraLib(
                source,
                `file:///node_modules/${virtualPath}`,
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
      // add virtual path to monaco's tsconfig's `path`-property
      const tsCompilerOptions = unwrap({
        ...props?.tsconfig,
        paths: {
          ...(props?.tsconfig?.paths ? wrapPaths(props.tsconfig.paths) : undefined),
          ...props.runtime.types.alias,
          ...(props.runtime.fs.alias ? wrapPaths(props.runtime.fs.alias) : undefined),
        },
      })

      monaco.languages.typescript.typescriptDefaults.setCompilerOptions(tsCompilerOptions as any)
      monaco.languages.typescript.javascriptDefaults.setCompilerOptions(tsCompilerOptions as any)
    })
  })

  createEffect(() => {
    const monaco = resources()?.[0]
    if (!props.runtime.config.debug) return
    if (!monaco) return
    console.info(...formatInfo('monaco loaded', monaco))
  })

  return monaco
}
