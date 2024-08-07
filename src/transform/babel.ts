import type * as Babel from '@babel/standalone'
import { Transform } from 'src/runtime/runtime'

export interface BabelConfig {
  babel: typeof Babel | Promise<typeof Babel>
  presets?: string[]
  plugins?: (string | babel.PluginItem)[]
  cdn?: string
}

export async function babelTransform(config: BabelConfig): Promise<Transform> {
  const cdn = config.cdn || 'https://esm.sh'

  const [babel, presets, plugins] = await Promise.all([
    config.babel,
    Promise.all(
      config.presets?.map(preset =>
        import(/* @vite-ignore */ `${cdn}/${preset}`).then(module => module.default),
      ) || [],
    ),
    Promise.all(
      config.plugins?.map(plugin =>
        typeof plugin === 'string'
          ? import(/* @vite-ignore */ `${cdn}/${plugin}`).then(module => module.default)
          : plugin,
      ) || [],
    ),
  ])

  return (source: string, path: string) => {
    const result = babel.transform(source, {
      presets,
      plugins,
    }).code

    if (!result) throw `Babel transform failed for file ${path} with source: \n\n ${source}`

    return result
  }
}
