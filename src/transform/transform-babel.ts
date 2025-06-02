import type * as Babel from '@babel/standalone'

type Transform = (source: string, path: string) => string

export interface BabelConfig {
  babel?: typeof Babel | Promise<typeof Babel>
  presets?: string[]
  plugins?: (string | babel.PluginItem)[]
  cdn?: string
}

function resolveItems({
  cdn,
  babel,
  items,
  type,
}: {
  cdn: string
  babel: typeof Babel
  items?: (string | [string, unknown] | unknown)[]
  type: 'plugins' | 'presets'
}): Promise<any[]> {
  if (!items) return Promise.resolve([])
  const availableItems = type === 'plugins' ? babel.availablePlugins : babel.availablePresets
  return Promise.all(
    items.map(async function resolveItem(item: string | [string, unknown] | unknown) {
      let name: string
      let options: unknown = undefined

      // Handle both string and array types
      if (typeof item === 'string') {
        name = item
      } else if (Array.isArray(item) && typeof item[0] === 'string') {
        ;[name, options] = item
      } else {
        return item // Return non-string, non-array items directly
      }

      // Check for item in available items or import from CDN
      if (name in availableItems) {
        return options !== undefined ? [availableItems[name], options] : availableItems[name]
      } else {
        const module = await import(/* @vite-ignore */ `${cdn}/${name}`).then(
          module => module.default,
        )
        return options !== undefined ? [module, options] : module
      }
    }),
  )
}

export async function babelTransform(config: BabelConfig): Promise<Transform> {
  const cdn = config.cdn || 'https://esm.sh'

  const babel = await (config.babel ||
    (import(/* @vite-ignore */ `${cdn}/@babel/standalone`) as Promise<typeof Babel>))

  const [presets, plugins] = await Promise.all([
    resolveItems({ cdn, babel, items: config.presets, type: 'presets' }),
    resolveItems({ cdn, babel, items: config.plugins, type: 'plugins' }),
  ])

  return (source, path) => {
    const result = babel.transform(source, {
      presets,
      plugins,
    }).code

    if (!result) throw `Babel transform failed for file ${path} with source: \n\n ${source}`

    return result
  }
}
