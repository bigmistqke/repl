import type TS from 'typescript'
import { defaultTransformModulePaths } from '../transform/transform-module-paths.ts'
import type { TransformConfig } from '../types.ts'

export interface JSExtensionConfig {
  cdn?: string
  compilerOptions?: TS.CompilerOptions
  readFile(path: string): string | undefined
  ts: typeof TS
  transpile?: boolean
  transform?(config: TransformConfig): string
}

export function createJSExtension(config: JSExtensionConfig) {
  return {
    type: 'javascript' as const,
    extend(options: Partial<JSExtensionConfig>) {
      return createJSExtension({ ...config, ...options })
    },
    transform({ source, ...options }: TransformConfig) {
      source = config.transpile ? config.ts.transpile(source, config.compilerOptions) : source
      source = config.transform ? config.transform({ source, ...options }) : source
      return defaultTransformModulePaths({
        ...options,
        ...config,
        source,
      })
    },
  }
}
