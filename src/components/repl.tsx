import clsx from 'clsx'
import { ComponentProps, Show, createEffect, createResource, splitProps } from 'solid-js'
import { Runtime, RuntimeConfig } from '../runtime'
import { runtimeContext } from '../use-runtime'
import { every, whenever, wrapNullableResource } from '../utils/conditionals'
import { deepMerge } from '../utils/deep-merge'
// @ts-expect-error
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
  const config = deepMerge(
    {
      cdn: 'https://esm.sh',
      typescript: {
        allowJs: true,
        allowNonTsExtensions: true,
        esModuleInterop: true,
        allowUmdGlobalAccess: true,
        // enums inlined
        jsx: /* JsxEmit.Preserve as */ 1,
        module: /* ModuleKind.ESNext as */ 99,
        moduleResolution: /* ModuleResolutionKind.Node10 as */ 2,
        target: /* ScriptTarget.ESNext as */ 99,
        paths: {},
      },
    },
    propsWithoutChildren,
  )

  const [typescript] = createResource(() => config.typescript.library)
  // We return undefined and prevent Babel from being imported in-browser,
  // If no babel-preset nor babel-plugin is present in the config.
  const [babel] = createResource(() => config.babel?.library)
  const [babelPresets] = createResource(() =>
    config.babel?.presets
      ? Promise.all(
          config.babel.presets.map(
            async preset => (await import(/* @vite-ignore */ `${config.cdn}/${preset}`)).default,
          ),
        )
      : [],
  )
  const [babelPlugins] = createResource(() =>
    config.babel?.plugins
      ? Promise.all(
          config.babel.plugins.map(async plugin => {
            if (typeof plugin === 'string') {
              return (await import(/* @vite-ignore */ `${config.cdn}/${plugin}`)).default
            }
            return plugin
          }),
        )
      : [],
  )

  // Once all resources are loaded, instantiate and initialize ReplContext
  const [runtime] = createResource(
    every(typescript, wrapNullableResource(babel), babelPlugins, babelPresets),
    async ([typescript, [babel], babelPlugins, babelPresets]) => {
      const repl = new Runtime(
        {
          typescript,
          babel,
          babelPlugins,
          babelPresets,
        },
        config,
      )
      await config.onSetup?.(repl)
      return repl
    },
  )

  createEffect(whenever(runtime, runtime => runtime.initialize()))

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
