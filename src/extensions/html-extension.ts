import { Accessor } from 'solid-js'
import { transformHtml } from 'src/transform/transform-html'
import { transformHtmlWorker } from 'src/transform/transform-html-worker'
import { TransformConfig } from 'src/types'

export interface HTMLExtensionConfig {
  transformModule: (config: TransformConfig) => Accessor<string>
}

export function createHTMLExtension(config: HTMLExtensionConfig) {
  return {
    type: 'html' as const,
    transform(options: TransformConfig) {
      return transformHtml({ ...config, ...options })
    },
  }
}

export function createHTMLExtensionWorker(config: HTMLExtensionConfig) {
  return {
    type: 'html' as const,
    transform(options: TransformConfig) {
      return transformHtmlWorker({ ...config, ...options })
    },
  }
}
