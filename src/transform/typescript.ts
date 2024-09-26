import { Transform } from 'src/runtime/runtime'
import type TS from 'typescript'

export interface TypescriptConfig {
  typescript?: typeof TS | Promise<typeof TS>
}

export async function typescriptTransform(config?: TypescriptConfig): Promise<Transform> {
  const ts: typeof TS = await (config?.typescript ||
    // @ts-expect-error
    (import(/* @vite-ignore */ 'https://esm.sh/typescript') as Promise<typeof TS>))
  return (runtime, source, path) => {
    const isTypescript = path.endsWith('ts') || path.endsWith('tsx')
    if (isTypescript) {
      return ts.transpile(source, runtime.config.tsconfig)
    }
    return source
  }
}
