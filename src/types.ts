export type FileType = 'javascript' | 'css' | 'html' | 'wasm' | 'plain'
export interface Extension {
  transform?: Transform
  type: FileType
}
export interface FileUrls {
  invalidate(path: string): void
  get(path: string, config?: { cached?: boolean }): string | undefined
}
export interface TransformConfig {
  path: string
  source: string
  fileUrls: FileUrls
}
export type Transform = (config: TransformConfig) => string
