import type { Accessor } from 'solid-js'
import { transformHtmlWorker } from '../transform/transform-html-worker.ts'
import { transformHtml } from '../transform/transform-html.ts'
import type { TransformConfig } from '../types.ts'

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
