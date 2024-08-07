import type TS from 'typescript'

export interface TypescriptConfig {
  typescript: typeof TS | Promise<typeof TS>
  tsconfig?: TS.CompilerOptions
}

export async function typescriptTransform(config: TypescriptConfig) {
  const ts = await config.typescript
  return (source: string, path: string) => {
    const isTypescript = path.endsWith('ts') || path.endsWith('tsx')
    if (isTypescript) {
      return ts.transpile(source, config.tsconfig)
    }
    return source
  }
}
