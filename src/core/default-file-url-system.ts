import { createHTMLExtension } from '../extension-presets/html-extension.ts'
import { createJSExtension, type JSExtensionConfig } from '../extension-presets/js-extension.ts'
import type { Extension } from '../types.ts'
import { createFileUrlSystem } from './create-file-url-system.ts'

export interface DefaultExtensionsConfig
  extends Omit<JSExtensionConfig, 'transpile' | 'transform'> {
  extensions?: Record<string, Extension>
  transformJs?: JSExtensionConfig['transform']
}

/**
 * Builds the `js`/`ts`/`tsx`/`html`/`css` extension map `defaultFileUrlSystem`
 * uses, so it can be handed to `createFileUrlSystem`, `<Repl/>`, or
 * `ReplElement` directly instead of going through `defaultFileUrlSystem`.
 */
export function defaultExtensions({
  extensions,
  transformJs,
  compilerOptions,
  readFile,
  ...rest
}: DefaultExtensionsConfig): Record<string, Extension> {
  const jsExtension = createJSExtension({
    ...rest,
    compilerOptions: {
      lib: ['ES2021'],
      target: 2 /* ScriptTarget.ES2015 */,
      module: 99 /* ModuleKind.ESNext */,
      esModuleInterop: true,
      sourceMap: true,
      composite: true,
      declaration: true,
      strict: true,
      skipLibCheck: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      ...compilerOptions,
    },
    readFile,
    transform: transformJs,
  })
  const tsExtension = jsExtension.extend({ transpile: true })
  const htmlExtension = createHTMLExtension({ transformModule: jsExtension.transform })

  return {
    css: { type: 'css' },
    js: jsExtension,
    ts: tsExtension,
    jsxExtension: tsExtension,
    tsx: tsExtension,
    html: htmlExtension,
    ...extensions,
  }
}

export interface DefaultFileUrlSystemConfig extends DefaultExtensionsConfig {}

export function defaultFileUrlSystem(config: DefaultFileUrlSystemConfig) {
  return createFileUrlSystem({
    readFile: config.readFile,
    extensions: defaultExtensions(config),
  })
}
