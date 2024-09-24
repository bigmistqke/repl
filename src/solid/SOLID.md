# Table of Contents

- [@bigmistqke/repl/solid](#bigmistqkereplsolid)
- [@bigmistqke/repl/solid/monaco-editor](#bigmistqkereplsolidmonaco-editor)
- [@bigmistqke/repl/solid/tm-editor](#bigmistqkereplsolidtm-editor)

# @bigmistqke/repl/solid

## Exports

- [Repl Component](#repl-component)
- [Frame Component](#frame-component)
- [DevTools Component](#devtools-component)
- [TabBar Component](#tabbar-component)
- [useRuntime Hook](#useruntime-hook)

## Repl Component

Initializes the Repl environment by dynamically loading the required libraries (`Babel` and `TypeScript`) and any Babel presets/plugins defined in the props. Configures and instantiates `ReplContext`, which sets up `FileSystem` and `TypeRegistry`. The component ensures no children are rendered until all dependencies are fully loaded and the optional `onSetup`-callback has been completed.

It provides access for its children to its internal `Runtime` through the `useRuntime`-hook.

```typescript
type ReplPropsBase = ComponentProps<'div'> &
  Omit<RuntimeConfig, 'transform' | 'transformModulePaths'>
interface ReplProps extends ReplPropsBase {
  /** Required module path transformer, such as `@bigmistqke/transform-module-path/typescript`, to resolve external modules and relative imports. */
  transformModulePaths: TransformModulePaths | Promise<TransformModulePaths>
  /** Required code transformer, such as `@bigmistqke/transform/babel`, for transpiling TypeScript to JavaScript. */
  transform: Transform | Promise<Transform>
}
```

### Usage

```tsx
import { Repl } from '@bigmistqke/repl'
import { typescriptTransformModulePaths } from '@bigmistqke/repl/transform-module-paths/typescript'
import { babelTransform } from '@bigmistqke/repl/transform/babel'
import { babelSolidReplPlugin } from '@bigmistqke/repl/plugins/babel-solid-repl'

const repl = (
  <Repl
    transformModulePaths={typescriptTransformModulePaths(import('https://esm.sh/typescript'))}
    transform={babelTransform({
      babel: import('https://esm.sh/@babel/standalone'),
      presets: ['babel-preset-solid'],
      plugins: [babelSolidReplPlugin],
    })}
    initialState={{
      files: {
        './index.ts': 'export const sum = (a: number, b: number) => a + b',
      },
    }}
  />
)
```

## Frame Component

Manages individual `<iframe/>` containers for isolated execution environments.

```typescript
/** Props for the Frame component */
interface FrameProps extends ComponentProps<'iframe'> {
  /** An identifier for the Frame. Defaults to `default`. */
  name?: string
  /** CSS properties as a string or JSX.CSSProperties object to apply to the `<iframe/>` body. */
  bodyStyle?: JSX.CSSProperties | string
}
```

### Usage

```tsx
import { Frame, Repl } from '@bigmistqke/repl'

const repl = (
  <Repl>
    <Frame
      style={{ flex: 1 }}
      name="frame-2"
      bodyStyle={{
        padding: '0px',
        margin: '0px',
      }}
    />
  </Repl>
)
```

## DevTools Component

`DevTools` embeds an iframe to provide a custom Chrome DevTools interface for debugging purposes, provided by [`chii`](https://github.com/liriliri/chii) and [`chobitus`](https://github.com/liriliri/chobitsu).

This component connects to a [`Frame`](#frame-component) with the same `name` prop to display and interact with the frame's runtime environment, including console outputs, DOM inspections, and network activities. If no `name` is provided it will default to `default`.

```typescript
/** Props for the DevTools component */
interface DevToolsProps extends ComponentProps<'iframe'> {
  /** Unique name used to link the DevTools with a specific Frame. */
  name: string
}
```

### Usage

```tsx
import { DevTools, Repl } from '@bigmistqke/repl'

// To debug a frame named 'example'
const repl = (
  <Repl>
    <Frame name="example" />
    <DevTools name="example" />
  </Repl>
)
```

## TabBar Component

A minimal wrapper around `<For/>` to assist with navigating between different files opened in the editor.

```typescript
/** Props for the TabBar component */
interface TabBarProps extends ComponentProps<'div'> {
  /** A callback with the `path` and the corresponding `File` as arguments. Expects a `JSX.Element` to be returned. */
  children: (arg: { path: string; file: File | undefined }) => JSXElement
  /** An array of strings to filter and sort existing paths. */
  paths: string[]
}
```

### Usage

```tsx
import { TabBar, Repl } from '@bigmistqke/repl'

const repl = (
  <Repl>
    <TabBar style={{ flex: 1 }}>
      {({ path }) => <button onClick={() => ...}>{path}</button>}
    </TabBar>
  </Repl>
)
```

## useRuntime Hook

Hook to interact with the internal `Runtime` of `@bigmistqke/repl`. This class contains the virtual [`FileSystem`](#filesystem), [`TypeRegistry`](#typeregistry) and [`FrameRegistry`](#frameregistry).

This hook should be used in a descendant of [`Repl`](#repl-component), otherwise it will throw.

```typescript
/** Hook to interact with the internal Runtime */
type useRuntime = (): Runtime
```

### Usage

```ts
import { useRuntime } from '@bigmistqke/repl'

const { frameRegistry, fileSystem } = useRuntime()

const frame = frameRegistry.get('default')
const entry = fileSystem.get('src/index.ts')

frame?.injectFile(entry)
```

# Editors

The @bigmistqke/repl package offers integrations with various code editors, which are available as separate entry-points within the package. Currently, integrations are provided for two code editors:

1. [`monaco-editor`](https://microsoft.github.io/monaco-editor/)
2. [`tm-textarea`](https://github.com/bigmistqke/tm-textarea).

## @bigmistqke/repl/solid/monaco-editor

This package exports both the `MonacoEditor` and `MonacoProvider` component.

`MonacoEditor` embeds a [`monaco-editor`](https://microsoft.github.io/monaco-editor/) instance for editing files. This editor supports integrated typing assistance, including auto-completions and type-checking, and offers the standard keybindings expected in code editors.

The `MonacoProvider` component is responsible for initializing Monaco and making it available to descendant components via context. This setup enables multiple instances of `MonacoEditor` to utilize a single Monaco instance. However, it is also possible to use `MonacoEditor` outside of a `MonacoProvider`. In this case, the `MonacoEditor` will instantiate a new Monaco instance instead of sharing the one provided by `MonacoProvider`.

You must provide the `monaco` and `theme` props to `MonacoProvider`. This flexibility allows users to import Monaco from a CDN or their own server, either statically or dynamically.

For `MonacoEditor`, providing `monaco` and `theme` is optional because it can function both inside and outside of `MonacoProvider`. If `MonacoEditor` is used outside of `MonacoProvider`, it requires `monaco` and `theme` props to be defined and will throw an error if they are missing. If `MonacoEditor` is used within a `MonacoProvider`, the provided `monaco` and `theme` props will be ignored with a warning.

**Note: if you want to automatically import types of external packages you have to enable the `importExternalTypes`-prop of [`Repl`](#repl-component).**

```ts
interface MonacoProviderProps {
  /** Required static or dynamic import of `MonacoTheme`. Theme needs to be optimized to make use of TextMate. */
  theme: MonacoTheme | Promise<MonacoTheme>
  /** Required static or dynamic import of `Monaco` */
  monaco: Promise<Monaco> | Monaco
  /** Optional compiler options for typescript */
  tsconfig?: ts.CompilerOptions
}

type MonacoEditorPropsBase = ComponentProps<'div'> & MonacoProviderProps

interface MonacoEditorProps extends MonacoEditorPropsBase {
  /** Required path of the file in the virtual filesystem */
  path: string
  /** Optional callback that is executed when the editor is fully mounted */
  onMount?: (editor: MonacoEditor) => void
  /** Optional arguments to `monaco.editor.create()` */
  editor?: MonacoEditorConfig
}
```

### Usage

#### Using `MonacoEditor` with `MonacoProvider`

When using `MonacoProvider`, multiple `MonacoEditor` components can share the same Monaco instance. This setup is more efficient when you have multiple editors, as it reduces the overhead of initializing multiple instances of Monaco.

```tsx
import { Repl } from '@bigmistqke/repl'
import { MonacoProvider, MonacoEditor } from '@bigmistqke/repl/solid/monaco-editor'
import loader from '@monaco-editor/loader'
import vs_dark from '@bigmistqke/repl/solid/monaco-editor/themes/vs_dark_good.json'
import { createSignal } from 'solid-js'

const repl = (
  <Repl>
    <MonacoProvider monaco={loader.init()} theme={vs_dark} tsconfig={tsconfig}>
      <MonacoEditor path="src/index.tsx" />
      <MonacoEditor path="src/another.tsx" />
    </MonacoProvider>
  </Repl>
)
```

#### Using `MonacoEditor` without `MonacoProvider`

If you use `MonacoEditor` outside of a `MonacoProvider`, it will instantiate its own Monaco instance. This can be useful for simple applications with only one editor, or when you need isolated Monaco instances.

```tsx
import { Repl } from '@bigmistqke/repl'
import { MonacoEditor } from '@bigmistqke/repl/solid/monaco-editor'
import loader from '@monaco-editor/loader'
import vs_dark from '@bigmistqke/repl/solid/monaco-editor/themes/vs_dark_good.json'
import { createSignal } from 'solid-js'

const repl = (
  <Repl>
    <MonacoEditor path="src/index.tsx" monaco={loader.init()} theme={vs_dark} />
  </Repl>
)
```

## @bigmistqke/repl/solid/tm-editor

`TmEditor` is a tiny, minimal text editor built on the [`tm-textarea`](https://github.com/bigmistqke/tm-textarea) syntax highlighting library, which utilizes [`TextMate`](https://github.com/microsoft/vscode-textmate) grammar. Internally, it is composed of a standard `<textarea/>` with syntax-highlighted HTML rendered underneath.

In contrast to the [`MonacoEditor`](#monacoprovider-and-monacoeditor-component), `TmEditor` lacks type-checking and type-information capabilities, and it does not modify any existing key-bindings. As such, it is not ideal for full-featured playgrounds, but is well-suited for simpler applications such as articles and documentation.

```tsx
interface TmEditorProps extends ComponentProps<'div'> {
  /** The default source code to initialize the editor with. */
  defaultValue?: string
  /** The path of the file in the virtual filesystem. */
  path: string
  /** The theme to apply for syntax highlighting. */
  theme: Theme
  /** The source code to be displayed and edited. */
  value: string
  /** Callback function to handle updates to the source code. */
  onInput?: (source: string) => void
}
```

### Usage

```tsx
import { Repl } from '@bigmistqke/repl'
import { TmEditor } from '@bigmistqke/repl/solid/tm-editor'

const repl = (
  <Repl>
    <TmEditor style={{ flex: 1 }} path={currentPath()} theme="andromeeda" />
  </Repl>
)
```
