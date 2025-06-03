import { createHTMLExtension } from 'src/extensions/html-extension'
import { createJSExtension, JSExtensionConfig } from 'src/extensions/js-extension'
import { Extension } from 'src/types'
import { createFileUrlSystem } from './create-file-url-system'

export interface DefaultFileUrlSystemConfig
  extends Omit<JSExtensionConfig, 'transpile' | 'transform'> {
  extensions?: Record<string, Extension>
  transformJs?: JSExtensionConfig['transform']
}

export function defaultFileUrlSystem({
  extensions,
  transformJs,
  ...config
}: DefaultFileUrlSystemConfig) {
  const jsExtension = createJSExtension({ ...config, transform: transformJs })
  const tsExtension = jsExtension.extend({ transpile: true })
  const htmlExtension = createHTMLExtension({ transformModule: jsExtension.transform })

  return createFileUrlSystem({
    readFile: config.readFile,
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
