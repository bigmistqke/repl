<p>
  <img width="100%" src="https://assets.solidjs.com/banner?type=@bigmistqke/repl&background=tiles&project=%20" alt="@bigmistqke/repl">
</p>

<h1 id="title">@bigmistqke/repl</h1>

`@bigmistqke/repl` provides unstyled building blocks to create TypeScript playgrounds directly in the browser, featuring adaptable editor integration. Currently, it supports both the feature-rich [`Monaco Editor`](#monaco-editor-integration) and the lighter [`Shiki Editor`](#shiki-editor-integration). It supports real-time transpilation of TypeScript into ECMAScript Modules (ESM) and facilitates seamless imports of external dependencies, including their type definitions, making it ideal for both quick prototyping and complex browser-based IDE development.

https://github.com/bigmistqke/repl/assets/10504064/50195cb6-f3aa-4dea-a40a-d04f2d32479d

**_Click [here](#example-overview) for a line-by-line explanation of the above example and [here](https://bigmistqke.github.io/repl/) for a live-demo._**

## Features

- **Modular Editor Integration**: Start with [`Monaco Editor`](#monaco-editor-integration) for a fully featured IDE-like experience or [`Shiki Editor`](#shiki-editor-integration) for a more minimal editor. The architecture is designed to accommodate additional editors as needed.
- **Real-time Transpilation**: Transpile TypeScript into ESM on-the-fly, enabling immediate feedback and iteration.
- **Automatic Dependency Management**: Effortlessly manage imports of external libraries and their associated types, streamlining the development process.
- **Configurable and Extensible**: Tailor the setup to your needs with configurable TypeScript compiler settings, and easily extend functionalities through a flexible API.

# Table of Contents

- [Installation](#installation)
- [Entries](#entries)
- [___@bigmistqke/repl___](#bigmistqkerepl)
  - [Repl Component](#repl-component)
  - [Frame Component](#frame-component)
  - [TabBar Component](#tabbar-component)
  - [DevTools Component](#devtools-component)
  - [useRuntime Hook](#useruntime-hook)
- [Editors](#editors)
  - [___@bigmistqke/repl/editor/monaco___](#bigmistqkerepleditormonaco)
  - [___@bigmistqke/repl/editor/shiki___](#bigmistqkerepleditorshiki)
- [___@bigmistqke/repl/runtime___](#bigmistqkereplruntime)
  - [Exports](#exports)
  - [Runtime Class](#runtime-class)
  - [File Abstract Class](#file-abstract-class)
    - [JsFile Class](#jsfile-class)
    - [CssFile Class](#cssfile-class)
  - [Module Abstract Class](#module-class)
    - [JsModule Class](#jsmodule-class)
    - [CssModule Class](#cssmodule-class)
  - [FrameRegistry Class](#frameregistry-class)
  - [Frame Class](#frame-class)
  - [PackageJsonParser Class](#packagejsonparser-class)
  - [TypeRegistry Class](#typeregistry-class)
  - [TypeImportUtils Class](#typeimportutils-class)
- [Plugins](#plugins)
  - [___@bigmistqke/repl/plugins/rollup-service-worker___](#bigmistqkereplpluginsrollup-service-worker)
  - [___@bigmistqke/repl/plugins/babel-solid-repl___](#bigmistqkereplpluginsbabel-solid-repl)
- [Transform Utilities](#transform-utilities)
  - [___@bigmistqke/repl/transform/babel___](#bigmistqkerepltransformbabel)
  - [___@bigmistqke/repl/transform/typescript___](#bigmistqkerepltransformtypescript)
- [Transform Module Paths Utilities](#transform-module-path-utilities)
  - [___@bigmistqke/repl/transform-module-paths/typescript___](#bigmistqkerepltransform-module-pathstypescript)
- [Examples](#examples)
  - [Simple Example](#simple-example)
  - [Advanced Example](#advanced-example)
- [Acknowledgements](#acknowledgements)

# Installation

Import package from package manager.

```bash
npm install `@bigmistqke/repl`
yarn add `@bigmistqke/repl`
pnpm install `@bigmistqke/repl`
```

# Entries

The `@bigmistqke/repl` library is designed to be modular, allowing users to import only the parts they need for their project from a CDN if they would like to. Below is a list of all available modules within the `@bigmistqke/repl` ecosystem:

- **[@bigmistqke/repl](#bigmistqkerepl)**: The main entry point that includes the primary repl component and foundational utilities.
- **[@bigmistqke/repl/editor/monaco](#bigmistqkerepleditormonaco)**: Integrates the Monaco editor, providing a rich coding environment.
- **[@bigmistqke/repl/editor/shiki](#bigmistqkerepleditorshiki)**: Adds syntax highlighting through the Shiki library.
- **[@bigmistqke/repl/runtime](#bigmistqkereplruntime)**: Contains core runtime functionalities necessary for creating and managing the virtual environment within the repl.
- **[@bigmistqke/repl/plugins/rollup-service-worker](#bigmistqkereplpluginsrollup-service-worker)**: Enhances the repl with service worker capabilities to efficiently manage caching.
- **[@bigmistqke/repl/plugins/babel-solid-repl](#bigmistqkereplpluginsbabel-solid-repl)**: Provides plugins for Babel that are optimized for SolidJS applications.
- **[@bigmistqke/repl/transform/babel](#bigmistqkerepltransformbabel)**: Supports the integration of Babel for dynamic JavaScript code transformation.
- **[@bigmistqke/repl/transform/typescript](#bigmistqkerepltransformtypescript)**: Allows for the inclusion and use of the TypeScript compiler for code transformation.
- **[@bigmistqke/repl/transform-module-paths/typescript](#bigmistqkerepltransform-module-pathstypescript)**: Offers utilities for managing and transforming module paths in TypeScript files, crucial for resolving imports and integrating external modules.


# @bigmistqke/repl

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
type ReplPropsBase = ComponentProps<'div'> & Omit<RuntimeConfig, 'transform' | 'transformModulePaths'>
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

const repl = <Repl
  transformModulePaths={typescriptTransformModulePaths(import('https://esm.sh/typescript'))}
  transform={babelTransform({
    babel: import('https://esm.sh/@babel/standalone'),
    presets: ['babel-preset-solid'],
    plugins: [babelSolidReplPlugin],
  })}
  initialState={{
    files: {
      "./index.ts": "export const sum = (a: number, b: number) => a + b"
    }
  }}
/>
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
2. minimal, homemade editor built on top of [`shiki`](https://shiki.style/): [`solid-shiki-textarea`](https://github.com/bigmistqke/solid-shiki-textarea). Originally built for this project, now abstracted into its own package.

## @bigmistqke/repl/editor/monaco

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

####  Using `MonacoEditor` with `MonacoProvider`

When using `MonacoProvider`, multiple `MonacoEditor` components can share the same Monaco instance. This setup is more efficient when you have multiple editors, as it reduces the overhead of initializing multiple instances of Monaco.

```tsx
import { Repl } from '@bigmistqke/repl'
import { MonacoProvider, MonacoEditor } from '@bigmistqke/repl/editor/monaco'
import loader from '@monaco-editor/loader'
import vs_dark from '@bigmistqke/repl/editor/monaco/themes/vs_dark_good.json'
import { createSignal } from 'solid-js'

const repl = (
  <Repl>
    <MonacoProvider 
      monaco={loader.init()} 
      theme={vs_dark} 
      tsconfig={tsconfig}
    >
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
import { MonacoEditor } from '@bigmistqke/repl/editor/monaco'
import loader from '@monaco-editor/loader'
import vs_dark from '@bigmistqke/repl/editor/monaco/themes/vs_dark_good.json'
import { createSignal } from 'solid-js'

const repl = (
  <Repl>
    <MonacoEditor 
      path="src/index.tsx" 
      monaco={loader.init()} 
      theme={vs_dark} 
    />
  </Repl>
)
```

## @bigmistqke/repl/editor/shiki

`ShikiEditor` is a tiny, minimal text editor built on the [`shiki`](https://github.com/shikijs/shiki) syntax highlighting library, which utilizes [`TextMate`](https://github.com/microsoft/vscode-textmate) grammar. Internally, it is composed of a standard `<textarea/>` with syntax-highlighted HTML rendered underneath.

In contrast to the [`MonacoEditor`](#monacoprovider-and-monacoeditor-component), `ShikiEditor` lacks type-checking and type-information capabilities, and it does not modify any existing key-bindings. As such, it is not ideal for full-featured playgrounds, but is well-suited for simpler applications such as articles and documentation.

```tsx
interface ShikiEditorProps extends ComponentProps<'div'> {
  /** The default source code to initialize the editor with. */
  defaultValue?: string
  /** The programming language of the source code for syntax highlighting. */
  lang: Promise<LanguageRegistration[]> | LanguageRegistration[]
  /** The path of the file in the virtual filesystem. */
  path: string
  /** The theme to apply for syntax highlighting. */
  theme:
    | Promise<ThemeRegistrationRaw | ThemeRegistration>
    | ThemeRegistrationRaw
    | ThemeRegistration
  /** The source code to be displayed and edited. */
  value: string
  /** Callback function to handle updates to the source code. */
  onInput?: (source: string) => void
}
```

### Usage

```tsx
import { Repl } from '@bigmistqke/repl'
import { ShikiEditor } from '@bigmistqke/repl/editor/shiki'
import andromeeda from "shiki/themes/andromeeda.mjs"
import tsx from "shiki/langs/tsx.mjs"

const repl = (
  <Repl>
    <ShikiEditor 
      style={{ flex: 1 }} 
      path={currentPath()} 
      lang={tsx} 
      theme={andromeeda} 
    />
  </Repl>
)
```

# @bigmistqke/repl/runtime

This module provides a separate export for the runtime of @bigmistqke/repl. While the `Runtime` class coordinates all internal operations, we also export internal classes to offer greater flexibility for users who need more granular control.

## Exports

- [Runtime](#runtime-class)
- [File](#file-abstract-class)
  - [JsFile](#jsfile-class)
  - [CssFile](#cssfile-class)
- [Module](#module-abstract-class)
  - [JsModule](#jsmodule-class)
  - [CssModule](#cssmodule-class)
- [FrameRegistry](#frameregistry-class)
- [Frame](#frame-class)
- [PackageJsonParser](#packagejsonparser-class)
- [TypeRegistry](#typeregistry-class)
- [TypeImportUtils](#typeimportutils-class)

## Runtime Class

The `Runtime` class serves as the central coordination point of the repl environment, integrating essential libraries and configurations necessary for its operation. It orchestrates interactions between various subsystems, including the file system, frame registry, type management, and module transformation. This setup ensures a cohesive and efficient development environment within the browser.

```typescript
class Runtime {
  constructor(config: RuntimeConfig)

  /** Configurations for the runtime environment. */
  config: Mandatory<RuntimeConfig, 'cdn'>
  /** Manages file operations within the virtual file system. */
  fileSystem: FileSystem
  /** Handles the registration and management of iframe containers for isolated code execution. */
  frameRegistry: FrameRegistry
  /** Manages TypeScript declaration files and other type-related functionality. */
  typeRegistry: TypeRegistry
  /** Utility class for handling imports from URLs pointing to non-esm packages. */
  import: ImportUtils

  /** Initializes the file system based on provided initial configuration. */
  initialize(): void
  /**
   * Serializes the current state of the repl into JSON format.
   * @returns JSON representation of the repl state.
   */
  toJSON(): RuntimeState
  /**
   * Triggers a download of the current repl state as a JSON file.
   * @param [name='repl.config.json'] - Name of the file to download.
   */
  download(name?: string): void
}

/** Configuration settings for the repl runtime. */
interface RuntimeConfig {
  /** The CDN URL used to load TypeScript and other external libraries. Defaults to `esm.sh` */
  cdn?: string
  /** CSS class for styling the root repl component. */
  class?: string
  /** Log internal events. Defaults to `false`. */
  debug?: boolean
  /** Initial state of the virtual file system to preload files. */
  initialState?: InitialState
  /** Import external types from the CDN. Defaults to `false`. */
  importExternalTypes?: boolean
  /**
   * Function to transform the source code.
   * @param source - The source code to transform.
   * @param path - The path of the source file.
   * @returns The transformed source code.
   */
  transform: (source: string, path: string) => string
  /**
   * Function to transform module paths.
   * @param source - The source code containing module paths.
   * @param callback - A callback function to transform each module path. When returning `null` the module-import/export is removed.
   * @returns The transformed module-path (will remove the module-declaration).
   */
  transformModulePaths: (source: string, callback: (value: string) => string | null) => string | undefined
  /** Callback function that runs after initializing the editor and file system. */
  onSetup?: (runtime: Runtime) => Promise<void> | void
}
```

### Usage

You can import and initialize the `Runtime` class from `@bigmistqke/repl/runtime`.

```ts
import { Runtime } from '@bigmistqke/repl/runtime'

const runtimeConfig = {
  cdn: 'https://esm.sh',
  initialState: {
    files: { /* initial file states */ },
    types: { /* initial type states */ },
  },
  transform: (source, path) => { /* transform code */ },
  transformModulePaths: (source, callback) => { /* transform module paths */ },
}

const runtime = new Runtime(runtimeConfig)
runtime.initialize()
```

## File Abstract Class

The abstract `File` class represents a generic file within the repl environment.

```typescript
abstract class File {
  constructor(name: string, content: string)

  /** The name of the file. */
  name: string
  /** The content of the file. */
  content: string
}
```

### JsFile Class

The `JsFile` class represents javascript and typescript files within the repl environment.

```typescript
class JsFile extends File {
  constructor(public runtime: Runtime, public path: string)

  /** Module associated with the JavaScript file. */
  module: JsModule
}
```

### CssFile Class

The `CssFile` class represents css files within the repl environment.

```typescript
class CssFile extends File {
  constructor(public runtime: Runtime, public path: string)

  /** Module associated with the JavaScript file. */
  module: CssModule
}
```

## Module Abstract Class

The abstract `Module` class represents a generic file within the repl environment.

```typescript
abstract class Module {
  /**
   * Generates a new URL for an ES Module based on the current source code. This URL is not cached,
   * ensuring that each call provides a fresh module.
   * @returns A string representing the URL, or undefined if it cannot be generated.
   */
  abstract generate: Accessor<string | undefined>
  /** The current URL of the loaded module, if available. */
  abstract url: string | undefined
}
```

### JsModule Class

`JsModule` represents a JavaScript module capable of transpilation and dynamic import handling within the system. 

```typescript
class JsModule extends Module {
  constructor(runtime: Runtime, file: JsFile) 

  /** Generate an `ObjectUrl` to the module. */
  generate: Accessor<string | undefined>
  /** Reactive state of CSS files imported into this JavaScript file. */
  cssImports: Accessor<CssFile[]>
  /** Setter for the cssImports state. */
  private setCssImports: Setter<CssFile[]>
  /** Retrieves the URL of the currently active module. */
  get url(): string

  /**
   * Executes the cleanup function attached to the `dispose` property of the window object in the provided frame.
   * This method is intended for use in environments where the cleanup logic is either explicitly mentioned in the code
   * or added through the code via a Babel transform: p.ex `solid-repl-plugin` of `@bigmistqke/repl/plugins`.
   * 
   * @param frame - The frame containing the window object on which the cleanup function is called.
   *                This is typically an iframe or a similar isolated environment where the UI components are rendered.
   */
  dispose(frame: Frame): void
}
```

### CssModule Class

The `CssModule` class represents a CSS module capable of handling style sheets within the `Runtime`.

```typescript
class CssModule extends Module {
  constructor(private file: CssFile) 

  /** Generate an `ObjectUrl` to a javascript-module that injects a stylesheet with the css-file's source.. */
  generate: Accessor<string | undefined>
  /** Retrieves the URL of the currently active CSS esm-module. */
  get url(): string | undefined

  /** Removes the style element associated with this module from the specified `Frame`. */
  dispose(frame: Frame): void
}
```


## FrameRegistry Class

This class handles the creation, retrieval, and management of [`Frame`](#frame) instances.

```typescript
class FrameRegistry {
  constructor()

  /** A record of Frame instances indexed by a unique name identifier. */
  private frames: Record<string, Frame>
  /** A setter function to update the frames record. */
  private setFrames: SetStoreFunction<Record<string, Frame>>

  /** Adds a new frame to the registry with the given name and window object. Used internally by `Frame`. */
  add(name: string, window: Window): void
  /** Deletes a frame from the registry by its name. Used internally by `Frame`. */
  delete(name: string): void
  /** Retrieves a frame by its name. */
  get(name: string): Frame | undefined
  /** Checks if a frame with the given name exists in the registry. */
  has(name: string): boolean
}
```


## Frame Class

Represents an individual `<iframe/>` within the application, managed by `Frame Registry`. It offers method to inject and execute Javascript and CSS code into its `Window`.

```typescript
class Frame {
  constructor(public contentWindow: Window) {}

  /** Injects and executes an url pointing to a module into the frame's contentWindow. */
  injectModuleUrl(moduleUrl: string): HTMLScriptElement
  /** Injects and executes the esm-module of the given `CssFile` or `JsFile` into the frame's contentWindow. */
  injectFile(file: CssFile | JsFile): HTMLScriptElement | undefined
  /** Dispose scripts of the given `CssFile` or `JsFile`. */
  dispose(file: CssFile | JsFile): ReturnType<File['dispose']>
}
```

## PackageJsonParser Class

Parses the package.json file from a given base URL. Used internally by [`TypeImportUtils`](#typeimportutils).

```typescript
class PackageJsonParser {
  /** Fetches and parses the package.json file. Will throw if no valid entry is found.*/
  async parse(baseUrl: string): Promise<{
    typesUrl: string | undefined;
    scriptUrl: string;
    packageName: string;
  }>
}
```

## TypeRegistry Class

Manages the registry of TypeScript types across the application, facilitating type definition management
and providing utilities for importing and resolving TypeScript definitions from various sources.
This class is crucial for maintaining type accuracy and enabling IntelliSense in the editor.

```typescript

interface TypeRegistryState {
  alias: Record<string, string[]>
  sources: Record<string, string>
}

class TypeRegistry {
  constructor(public runtime: Runtime)

  /** Record of path-names and their respective sources. */
  sources: Record<string, string>
  /** Record of aliases and the path-names they should be aliased to. */
  alias: Record<string, string[]>
  /** Utility class related to automatically importing types of external packages. */
  import: TypeImportUtils

  /** Converts the current state of the type registry into a JSON object. */
  toJSON(): TypeRegistryState
  /** Initializes the registry with a predefined state, setting up known types and aliases. */
  initialize(initialState: Partial<TypeRegistryState>): void
  /** Adds or updates a path in the TypeScript configuration to map to an aliased package. */
  aliasPath(packageName: string, virtualPath: string): void
  /** Adds or updates a type definition source to the registry. */
  set(path: string, value: string): void
  /** Checks if a specific path is already registered in the type sources. */
  has(path: string): boolean
}
```

## TypeImportUtils Class

Utilities to import the types, used internally by [`TypeRegistry`](#type-registry).

```typescript
class TypeImportUtils {
  constructor(
    public runtime: Runtime,
    public typeRegistry: TypeRegistry,
  )

  /** Initializes state, called internally by `TypeRegistry`. */
  initialize(initialState: Partial<TypeRegistryState>): void
  /** Imports type definitions from a URL, checking if the types are already cached before importing. */
  async fromUrl(url: string, packageName?: string) 
  /** Imports type definitions based on a package name by resolving it to a CDN path. */
  async fromPackageName(packageName: string) 
}
```

# Plugins

`@bigmistqke/repl` offers a variety of plugins for different tools to aid in creating playgrounds. These plugins are provided as distinct entries within the package.

## @bigmistqke/repl/plugins/rollup-service-worker

The `rollup-service-worker` plugin is designed to facilitate the integration of a service worker into your application during the build process using Rollup. The service worker caches requests to the CDN (specifically `esm.sh`), improving load times and reducing network dependency.

### Usage

Include the `rollup-service-worker` plugin in your Rollup configuration. The plugin will inject a service worker that caches network requests to `esm.sh`.

```ts
import { rollupServiceWorkerPlugin } from '@bigmistqke/repl/plugins/rollup-service-worker'

export default {
  // Other Rollup configuration options
  plugins: [rollupServiceWorkerPlugin()],
}
```

## @bigmistqke/repl/plugins/babel-solid-repl

The `babel-solid-repl` plugin is designed to enhance the integration of SolidJS with a repl environment. It ensures that previous render calls are cleaned up properly, simulating a form of Hot Module Replacement by disposing of artifacts from earlier render calls.

### Usage

Include the `babel-solid-repl` plugin in your Babel configuration. The plugin modifies the behavior of the `render` function from `solid-js/web` to assign the result to `window.dispose`, ensuring proper cleanup of previous render artifacts.

```ts
import { babelTransform } from '@bigmistqke/repl/transform/babel'
import { babelSolidReplPlugin } from '@bigmistqke/repl/plugins/babel-solid-repl'

<Repl 
  transform={babelTransform({
    babel: import('https://esm.sh/babel-standalone'),
    plugins: [babelSolidReplPlugin]
  })}
/>
```

### Transformation Example

The plugin modifies the following code:

```jsx
import { render } from 'solid-js/web';
import App from './App';

render(() => <App />, document.getElementById('root'));
```

to:

```jsx
import { render } from 'solid-js/web';
import App from './App';

window.dispose = render(() => <App />, document.getElementById('root'));
```

This ensures that each render call is properly disposed of, simulating Hot Module Replacement (HMR) behavior.

# Transform Utilities

Transform utilities in `@bigmistqke/repl` enable the integration of JavaScript and TypeScript code transformation within the repl environment. These utilities are designed to support dynamic transpilation of TypeScript and other code transformations directly in the browser.

`@bigmistqke/repl` allows users to provide their own transform functions instead of bundling specific tools. This approach offers developers flexibility to use the repl with different toolsets according to their project requirements.

The transform utilities currently support:

1. **TypeScript:** Facilitates the conversion of TypeScript code to JavaScript, handling TypeScript syntax and features.
2. **Babel:** Enables transformations of modern JavaScript, including JSX for frameworks like SolidJS and experimental JavaScript features not standard in browsers.

Future releases will include more integrations with other (PRs welcome!).

Developers need to supply a function that matches the following type signature:

```typescript
type TransformFn = (source: string, path: string) => string;
```

This function takes the source code and its path, returning the transformed code as a string. This design allows for customization beyond the default functionality, such as integrating additional syntax processing, code optimizations, or other transpilers.

## @bigmistqke/repl/transform/babel

This utility provides integration of [babel](https://babeljs.io/)-library within the `@bigmistqke/repl` environment.

```typescript
interface BabelConfig {
  /** Required dynamic or static import of babel standalone library */
  babel: typeof Babel | Promise<typeof Babel>
  /** Optional cdn from where to download given babel-plugins. Defaults to `esm.sh`. */
  cdn?: string
  /** Optional list of presets */
  presets?: string[]
  /** Optional list of plugins. If urls are provided, they will be resolved according to the given cdn. */
  plugins?: (string | babel.PluginItem)[]
}

async function babelTransform(config: BabelConfig): TransformFn
```

### Usage

```typescript
import { babelTransform } from '@bigmistqke/repl/transform/babel';

const repl = (
  <Repl
    transform={babelTransform({
      babel: import('https://esm.sh/@babel/standalone'),
      presets: ['babel-preset-solid'],
      plugins: [],
      cdn: `https://esm.sh`
    })}
  />
)

```

## @bigmistqke/repl/transform/typescript

This utility provides integration of typescript-compiler within the `@bigmistqke/repl` environment.

```typescript
interface TypescriptConfig {
  /** Required dynamic or static import of typescript compiler */
  typescript: typeof TS | Promise<typeof TS>
  /** Optional compiler options */
  tsconfig?: TS.CompilerOptions
}

async function typescriptTransform(config: TypescriptConfig): TransformFn
```

### Usage

```typescript
import { typescriptTransform } from '@bigmistqke/repl/transform/typescript';

const repl = (
  <Repl
    transform={typescriptTransform({
      typescript: import('https://esm.sh/typescript'), 
      tsconfig: {
        ...
      }
    })}
  />
)
```

# Transform Module Path Utilities

In the `@bigmistqke/repl` environment, managing module paths effectively addresses several specific challenges:

1. **Resolution of External Modules:** Ensuring that imports from sources such as CDNs are correctly resolved is crucial for external library integration.
2. **Resolution of Relative Paths:** Accurately mapping relative paths within the repl's virtual file system is essential for maintaining functional links between files.
3. **Removal of CSS Imports:** Since CSS imports in JavaScript or TypeScript files are not supported in-browser, these imports need to be transformed or removed to ensure compatibility.
4. **Collect Types of External Modules** To successfully import the types of external modules, `@bigmistqke/repl` needs to be able to map over the module-paths of the external module's `.d.ts` files.

To provide maximum flexibility and adaptability in tooling for these tasks, `@bigmistqke/repl` does not bundle specific tooling. Instead [`Repl`](#repl-component) and [`Runtime`](#runtime-class) require a generic function to be defined that can parse the module paths and transform these:

```tsx
type TransformModulePaths =  (
  code: string,
  //** Callback to modify module-declaration node. Return `null` to remove node from code. */
  callback: (source: string) => string | null,
) => string | undefined
```

This modular approach lets users choose their tooling and update it as needed without being locked into a specific technology stack predefined by the repl. Currently, `@bigmistqke/repl` provides a TypeScript-based utility, future expansions will include more diverse tooling options (PRs welcome!).

## @bigmistqke/repl/transform-module-paths/typescript

```typescript
import { typescriptTransformModulePaths } from '@bigmistqke/repl/transform-module-paths/typescript';

const repl = (
  <Repl 
    transformModulePaths={typescriptTransformModulePaths({
      typescript: import('https://esm.sh/typescript')
    })} 
  />
)
```

# Examples

## Simple Example

This straightforward example showcases how to set up and utilize the @bigmistqke/repl for a simple TypeScript computation directly within the browser. It illustrates the essential functionality of loading a single file, transpiling TypeScript, and executing a basic function, making it an ideal starting point for those new to integrating the REPL in their web applications.

```tsx
import { Repl, useRuntime } from '@bigmistqke/repl';
import { typescriptTransform } from '@bigmistqke/repl/transform/typescript';
import { typescriptTransformModulePaths } from '@bigmistqke/repl/transform-module-paths/typescript';

const initialState = {
  files: {
    sources: {
      'src/index.ts': `
export const sum = (a: number, b: number): number => a + b;
      `,
    },
  },
};

export default function App() {
  function onSetup({ fileSystem }: Runtime) {
    const file = fileSystem.get('src/index.ts');

    // Get esm-url from file
    const moduleUrl = file?.module.url;

    // Import module and call its function
    import(moduleUrl).then(module => {
      console.log('Sum of 1 and 2 is:', module.sum(1, 2));
    });
  }

  return (
    <Repl
      initialState={initialState}
      onSetup={onSetup}
      transform={typescriptTransform({
        typescript: import('https://esm.sh/typescript'),
      })}
      transformModulePaths={typescriptTransformModulePaths({
        typescript: import('https://esm.sh/typescript'),
      })}
    />
  );
}
```

## Advanced Example

This advanced example demonstrates how to setup a [solid](https://github.com/solidjs/solid) playground. This example includes integrations with `monaco-editor`, `babel`, `typescript` and the chrome devtools via `chobitsu`.

```tsx
import { DevTools, Frame, Repl } from '@bigmistqke/repl'
import { MonacoEditor, MonacoTheme } from '@bigmistqke/repl/editor/monaco'
import { babelSolidReplPlugin } from '@bigmistqke/repl/plugins/babel-solid-repl'
import vs_dark from '@bigmistqke/repl/editor/monaco/themes/vs_dark_good.json'
import { typescriptTransformModulePaths } from '@bigmistqke/repl/transform-module-paths/typescript'
import { babelTransform } from '@bigmistqke/repl/transform/babel'
import loader from '@monaco-editor/loader'
import { createEffect, mapArray } from 'solid-js'

export default function App() {
  return (
    <Repl
      importExternalTypes
      transformModulePaths={
        typescriptTransformModulePaths(import('https://esm.sh/typescript'))
      }
      transform={
        babelTransform({
          babel: import('https://esm.sh/@babel/standalone'),
          presets: ['babel-preset-solid'],
          plugins: [babelSolidReplPlugin],
        })
      }      
      initialState={{
        files: {
          sources: {
            'index.css': `body { background: blue; }`,
            'index.tsx': `import { render } from "solid-js/web";
              import { createSignal } from "solid-js";
              import "solid-js/jsx-runtime";
              import "./index.css";

              const [count, setCount] = createSignal(1);

              render(() => (
                <button onClick={() => setCount(count => count + 1)}>
                  {count()}
                </button>
              ), document.body);
            `,
          },
        },
      }}
      onSetup={({ fileSystem, frameRegistry }) {
        createEffect(() => {
          // Get the default frame from the frame registry
          const frame = frameRegistry.get('default')
          if (!frame) return

          // Get file in virtual filesystem that points to 'index.tsx'
          const entry = fileSystem.get('index.tsx')

          // Inject the entry's module URL into the frame's window
          createEffect(() => frame.injectFile(entry))

      // Inject the css-imports from the entry-file into the frame's window.
      createEffect(
        mapArray(entry.module.cssImports, css => {
          createEffect(() => frame.injectFile(css))
          onCleanup(() => frame.dispose(css))
        }),
      )
    })
  }

  return (
    <Repl
      importExternalTypes
      transformModulePaths={typescriptTransformModulePaths({ 
        typescript: import('https://esm.sh/typescript') 
      })}
      transform={babelTransform({
        babel: import('https://esm.sh/@babel/standalone'),
        presets: ['babel-preset-solid'],
        plugins: [babelSolidReplPlugin],
      })}      
      initialState={initialState}
      onSetup={onSetup}
    >
      <MonacoEditor 
        monaco={loader.init()}
        theme={vs_dark as MonacoTheme} 
        tsconfig={{
          target: 2, // ScriptTarget.ES2015
          module: 5, // ModuleKind.ES2015
          jsx: 1, // JsxEmit.Preserve
          jsxImportSource: 'solid-js',
          esModuleInterop: true,
        }}
        path='index.tsx'
      />
      <Frame />
      <DevTools />
    </Repl>
  )
}
```
