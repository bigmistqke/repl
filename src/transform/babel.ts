import * as Babel from '@babel/standalone'

export type BabelConfig = {
  babel: typeof Babel | Promise<typeof Babel>
  presets?: string[]
  plugins?: (string | babel.PluginItem)[]
}

export async function babelTransform(config: BabelConfig) {
  const [babel, presets, plugins] = await Promise.all([
    config.babel,
    Promise.all(
      config.presets?.map(preset => {
        return import(/* @vite-ignore */ `https://esm.sh/${preset}`).then(module => module.default)
      }) || [],
    ),
    Promise.all(
      config.plugins?.map(plugin => {
        if (typeof plugin === 'string')
          return import(/* @vite-ignore */ `https://esm.sh/${plugin}`).then(
            module => module.default,
          )
        return plugin
      }) || [],
    ),
  ])
  return (source: string) => {
    return babel.transform(source, {
      presets,
      plugins,
    }).code!
  }
}
