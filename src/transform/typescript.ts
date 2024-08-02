import type ts from 'typescript'

export type TypescriptConfig = {
  typescript: typeof ts | Promise<typeof ts>
  tsconfig: ts.CompilerOptions
}

export async function typescriptAdapter(config: TypescriptConfig) {
  const ts = await config.typescript
  return (source: string, path: string) => {
    const isTypescript = path.endsWith('ts') || path.endsWith('tsx')
    if (isTypescript) {
      return ts.transpile(source, config.tsconfig)
    }
    return source
  }
}
