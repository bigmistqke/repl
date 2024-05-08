import clsx from 'clsx'
import { ComponentProps, Show, createEffect, createResource, splitProps } from 'solid-js'
import { Runtime, RuntimeConfig } from 'src/runtime'
import { every, whenever, wrapNullableResource } from 'src/utils/conditionals'
import { deepMerge } from 'src/utils/deep-merge'
import { RuntimeProvider } from '../use-runtime'
import { ReplDevTools } from './dev-tools'
import { ReplMonacoEditor } from './editors/monaco-editor'
import { ReplMonacoProvider } from './editors/monaco-provider'
import { ReplShikiEditor } from './editors/shiki-editor'
import { ReplFrame } from './frame'
import { ReplTabBar } from './tab-bar'
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

  const [typescript] = createResource(() => import('typescript'))
  // We return undefined and prevent Babel from being imported in-browser,
  // If no babel-preset nor babel-plugin is present in the config.
  const [babel] = createResource(async () =>
    config.babel?.presets || config.babel?.plugins ? await import('@babel/standalone') : undefined,
  )
  const [babelPresets] = createResource(() =>
    config.babel?.presets
      ? Promise.all(
          config.babel.presets.map(
            async preset => (await import(`${config.cdn}/${preset}`)).default,
          ),
        )
      : undefined,
  )
  const [babelPlugins] = createResource(() =>
    config.babel?.plugins
      ? Promise.all(
          config.babel.plugins.map(async plugin => {
            if (typeof plugin === 'string') {
              return (await import(`${config.cdn}/${plugin}`)).default
            }
            return plugin
          }),
        )
      : undefined,
  )

  // Once all resources are loaded, instantiate and initialize ReplContext
  const [runtime] = createResource(
    every(
      typescript,
      wrapNullableResource(babel),
      wrapNullableResource(babelPlugins),
      wrapNullableResource(babelPresets),
    ),
    async ([typescript, [babel], [babelPlugins], [babelPresets]]) => {
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
        <RuntimeProvider value={runtime()}>
          <div
            data-dark-mode={props.mode || 'dark'}
            class={clsx(styles.repl, props.class)}
            {...rest}
          >
            {props.children}
          </div>
        </RuntimeProvider>
      )}
    </Show>
  )
}

/**
 * `Repl.Editor` embeds a `monaco-editor` instance for editing files.
 * It dynamically creates and binds a `monaco`-model and `File`
 * in the virtual `FileSystem` based on the provided `path`-prop.
 *
 * @param  props - The properties passed to the editor component.
 * @returns The container div element that hosts the Monaco editor.
 */
Repl.MonacoEditor = ReplMonacoEditor
Repl.MonacoProvider = ReplMonacoProvider
/**
 * `Repl.Frame` encapsulates an iframe element to provide an isolated execution
 * environment within the application. It is used to inject and execute CSS or JS module separately
 * from the main document flow.
 *
 * @param props - The props for configuring the iframe.
 * @returns The iframe element configured according to the specified props.
 *
 * @example
 * // To create an iframe with specific styles and a unique name:
 * <ReplFrame name="myCustomFrame" bodyStyle={{ backgroundColor: 'red' }} />
 */
Repl.Frame = ReplFrame
/**
 * `Repl.TabBar` is a utility-component to filter and sort `Files` of the virtual `FileSystem`.
 * This can be used to create a tab-bar to navigate between different files. It accepts an optional
 * prop of paths to sort and filter the files. If not provided it will display all existing files,
 * excluding files in the `node_modules` directory: This directory contains packages imported with
 * `FileSystem.importFromPackageJson()` and auto-imported types of external dependencies.
 *
 * @param props - The properties passed to the tab bar component.
 * @returns  The container div element that hosts the tabs for each file.
 */
Repl.TabBar = ReplTabBar
/**
 * `Repl.DevTools` embeds an iframe to provide a custom Chrome DevTools interface for debugging purposes.
 * It connects to a `Repl.Frame` with the same `name` prop to display and interact with the frame's runtime environment,
 * including console outputs, DOM inspections, and network activities.
 *
 * @param props - Props include standard iframe attributes and a unique `name` used to link the DevTools
 *                with a specific `Repl.Frame`.
 * @returns The iframe element that hosts the embedded Chrome DevTools, connected to the specified `Repl.Frame`.
 * @example
 * // To debug a frame named 'exampleFrame':
 * <Repl.Frame name="exampleFrame" />
 * <Repl.DevTools name="exampleFrame" />
 */
Repl.DevTools = ReplDevTools

Repl.ShikiEditor = ReplShikiEditor
