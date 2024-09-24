import { Runtime, RuntimeConfig } from '@bigmistqke/repl'
import { until } from '@solid-primitives/promise'
import clsx from 'clsx'
import {
  ComponentProps,
  Show,
  createEffect,
  createRenderEffect,
  createResource,
  mapArray,
  mergeProps,
  splitProps,
} from 'solid-js'
import { Transform, TransformModulePaths } from 'src/runtime/runtime'
import { runtimeContext } from 'src/solid'
import { every, whenever } from 'src/utils/conditionals'
import { formatInfo } from 'src/utils/format-log'
import styles from './repl.module.css'

type ReplPropsBase = ComponentProps<'div'> &
  Omit<RuntimeConfig, 'transform' | 'transformModulePaths'>
export interface ReplProps extends ReplPropsBase {
  transformModulePaths: TransformModulePaths | Promise<TransformModulePaths>
  transform: Transform | Promise<Transform> | Array<Transform | Promise<Transform>>
  files?: Record<string, string>
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
  const [, rest] = splitProps(props, ['cdn', 'children', 'class', 'files', 'files', 'onSetup'])
  const config = mergeProps(
    mergeProps(
      {
        cdn: 'https://esm.sh',
      },
      propsWithoutChildren,
    ),
  )

  const [transform] = createResource<Transform | Transform[]>(() =>
    Array.isArray(config.transform) ? Promise.all(config.transform) : config.transform,
  )
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
      }) as RuntimeConfig,
    )
    await props.onSetup?.(runtime)
    runtime.initialize()
    return runtime
  })
  createRenderEffect(
    whenever(
      every(runtime, () => config.files),
      ([runtime, files]) => {
        createRenderEffect(
          mapArray(
            () => Object.keys(files),
            key => {
              const file = runtime.fs.get(key) ?? runtime.fs.create(key)
              createRenderEffect(() => {
                file.set(files[key]!)
              })
            },
          ),
        )
      },
    ),
  )

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
