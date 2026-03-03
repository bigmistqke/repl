import { createHTMLExtension } from '../extension-presets/html-extension.ts'
import { createJSExtension, type JSExtensionConfig } from '../extension-presets/js-extension.ts'
import type { Extension } from '../types.ts'
import { createFileUrlSystem } from './create-file-url-system.ts'

export interface DefaultFileUrlSystemConfig
  extends Omit<JSExtensionConfig, 'transpile' | 'transform'> {
  extensions?: Record<string, Extension>
  transformJs?: JSExtensionConfig['transform']
}

export function defaultFileUrlSystem({
  extensions,
  transformJs,
  compilerOptions,
  readFile,
  ...rest
}: DefaultFileUrlSystemConfig) {
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

  return createFileUrlSystem({
    readFile,
    extensions: {
      css: { type: 'css' },
      js: jsExtension,
      ts: tsExtension,
      jsxExtension: tsExtension,
      tsx: tsExtension,
      html: htmlExtension,
      ...extensions,
    },
  })
}
