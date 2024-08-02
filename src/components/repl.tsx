import { until } from '@solid-primitives/promise'
import clsx from 'clsx'
import {
  ComponentProps,
  Show,
  createEffect,
  createResource,
  mergeProps,
  splitProps,
} from 'solid-js'
import { Transform, TransformModulePaths } from 'src/runtime/runtime'
import { formatInfo } from 'src/utils/format-log'
import { Runtime, RuntimeConfig } from '../runtime'
import { runtimeContext } from '../use-runtime'
import styles from './repl.module.css'

export type ReplProps = ComponentProps<'div'> &
  Omit<RuntimeConfig, 'transform' | 'transformModulePaths'> & {
    transformModulePaths: TransformModulePaths | Promise<TransformModulePaths>
    transform: Transform | Promise<Transform>
  }

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
    'cdn',
    'children',
    'class',
    'initialState',
    'onSetup',
  ])
  const config = mergeProps(
    mergeProps(
      {
        cdn: 'https://esm.sh',
      },
      propsWithoutChildren,
    ),
  )

  const [transform] = createResource(() => config.transform)
  const [transformModulePaths] = createResource(() => config.transformModulePaths)

  const [runtime] = createResource(async () => {
    await Promise.all([until(transform), until(transformModulePaths)])
    const runtime = new Runtime(
      mergeProps(config, {
        get transform() {
          return transform.latest!
        },
        get transformModulePaths() {
          return transformModulePaths.latest!
        },
      }),
    )
    await props.onSetup?.(runtime)
    runtime.initialize()
    return runtime
  })

  createEffect(() => {
    if (!config.debug) return
    createEffect(() => runtime() && console.info(...formatInfo('runtime initialized')))
  })

  return (
    <Show when={runtime()}>
      {runtime => (
        <runtimeContext.Provider value={runtime()}>
          <div class={clsx(styles.repl, props.class)} {...rest}>
            {props.children}
          </div>
        </runtimeContext.Provider>
      )}
    </Show>
  )
}
