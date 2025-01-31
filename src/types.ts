export type FileType = 'javascript' | 'css' | 'html' | 'wasm' | 'plain'
export interface Extension {
  transform?: Transform
  type: FileType
}
interface Executables {
  invalidate(path: string): void
  create(path: string): string | undefined
  get(path: string): string | undefined
}
export interface TransformConfig {
  path: string
  source: string
  executables: Executables
}
export type Transform = (config: TransformConfig) => string

export type Match = (glob: string) => (paths: Array<string>) => Array<string>
