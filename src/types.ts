import type { Accessor } from 'solid-js'

export type AccessorMaybe<T> = T | Accessor<T>

export type FileType = 'javascript' | 'css' | 'html' | 'wasm' | 'plain'
export interface Extension {
  transform?: Transform
  type: FileType
}
export interface FileUrlSystem {
  invalidate(path: string): void
  get(path: string, config?: { cached?: boolean }): string | undefined
}
export interface TransformConfig {
  path: string
  source: string
  fileUrls: FileUrlSystem
}
export type Transform = (config: TransformConfig) => Accessor<string> | string
