import clsx from 'clsx'
import {
  ComponentProps,
  Show,
  createEffect,
  createMemo,
  createResource,
  mergeProps,
  splitProps,
} from 'solid-js'
import { formatInfo } from 'src/utils/format-log'
import { Runtime, RuntimeConfig } from '../runtime'
import { runtimeContext } from '../use-runtime'
import styles from './repl.module.css'

export type ReplProps = ComponentProps<'div'> & RuntimeConfig

/**
 * Initializes the Repl environment by dynamically loading required libraries (`Babel` and `TypeScript`)
 * and any Babel presets/plugins defined in the props. Configures and instantiates `ReplContext`, which sets up `FileSystem`
 * and `TypeRegistry`. The component ensures no children are rendered until all dependencies are fully loaded and the optional
 * `onSetup`-callback has been completed.
 *
 * It provides access for its children to its internal `Runtime` through the `useRuntime`-hook.
 *
 * @param props Configuration properties for the Repl
 * @returns A JSX element that renders the Repl environment, delaying rendering of child components until all dependencies are loaded.
 */
export function Repl(props: ReplProps) {
  const [, propsWithoutChildren] = splitProps(props, ['children'])
  const [, rest] = splitProps(props, [
    'actions',
    'babel',
    'cdn',
    'children',
    'class',
    'initialState',
    'mode',
    'onSetup',
    'typescript',
  ])
  const config = mergeProps(
    {
      cdn: 'https://esm.sh',
    },
    propsWithoutChildren,
  )

  const [typescript] = createResource(() => config.typescript?.library)
  const [babel] = createResource(() => config.babel?.library)
  const [babelPresets] = createResource(() =>
    Promise.all(
      config.babel?.presets?.map(
        async preset => (await import(/* @vite-ignore */ `${config.cdn}/${preset}`)).default,
      ) || [],
    ),
  )
  const [babelPlugins] = createResource(() =>
    Promise.all(
      config.babel?.plugins?.map(async plugin => {
        if (typeof plugin === 'string') {
          return (await import(/* @vite-ignore */ `${config.cdn}/${plugin}`)).default
        }
        return plugin
      }) || [],
    ),
  )

  const dependenciesLoaded = createMemo(previous => {
    if (previous) return true
    if (!typescript()) return false
    if (config.babel && !(babel() && babelPlugins() && babelPresets())) return false
    return true
  }, false)

  const [runtime] = createResource(dependenciesLoaded, async () => {
    const runtime = new Runtime(
      {
        get typescript() {
          return typescript() || typescript.latest!
        },
        get babel() {
          return babel() || babel.latest
        },
        get babelPlugins() {
          return babelPlugins() || babelPlugins.latest || []
        },
        get babelPresets() {
          return babelPresets() || babelPresets.latest || []
        },
      },
      config,
    )
    await props.onSetup?.(runtime)
    runtime.initialize()
    return runtime
  })

  createEffect(() => {
    if (!config.debug) return
    createEffect(() => console.info(...formatInfo('typescript', typescript())))
    createEffect(() => console.info(...formatInfo('babel', babel())))
    createEffect(() => console.info(...formatInfo('babel-plugins', babelPlugins())))
    createEffect(() => console.info(...formatInfo('babel-presets', babelPresets())))
    createEffect(() => runtime() && console.info(...formatInfo('runtime initialized')))
  })

  return (
    <Show when={runtime()}>
      {runtime => (
        <runtimeContext.Provider value={runtime()}>
          <div
            data-dark-mode={props.mode || 'dark'}
            class={clsx(styles.repl, props.class)}
            {...rest}
          >
            {props.children}
          </div>
        </runtimeContext.Provider>
      )}
    </Show>
  )
}
