<p>
  <img width="100%" src="https://assets.solidjs.com/banner?type=@bigmistqke/repl&background=tiles&project=%20" alt="@bigmistqke/repl">
</p>

# @bigmistqke/repl

`@bigmistqke/repl` provides unstyled building blocks to create TypeScript playgrounds directly in the browser, featuring adaptable editor integration. Currently, it supports both the feature-rich `Monaco Editor` and the lighter `Shiki Editor` It supports real-time transpilation of TypeScript into ECMAScript Modules (ESM) and facilitates seamless imports of external dependencies, including their type definitions, making it ideal for both quick prototyping and complex browser-based IDE development.

https://github.com/bigmistqke/repl/assets/10504064/50195cb6-f3aa-4dea-a40a-d04f2d32479d

**_Click [here](#example-overview) for a line-by-line explanation of the above example and [here](https://bigmistqke.github.io/repl/) for a live-demo._**

## Features

- **Modular Editor Integration**: Start with `Monaco Editor` for an IDE-like experience or `Shiki Editor` for simpler syntax highlighting. The architecture is designed to accommodate additional editors as needed.
- **Real-time Transpilation**: Transpile TypeScript into ESM on-the-fly, enabling immediate feedback and iteration.
- **Automatic Dependency Management**: Effortlessly manage imports of external libraries and their associated types, streamlining the development process.
- **Configurable and Extensible**: Tailor the setup to your needs with configurable TypeScript compiler settings, and easily extend functionalities through a flexible API.

# Table of Contents

- [Installation](#installation)
- [Components Documentation](#components-documentation)
  - [`Repl` Component](#repl-component)
  - [`Repl.Frame` Component](#replframe-component)
  - [`Repl.TabBar` Component](#repltabbar-component)
  - [`Repl.DevTools` Component](#repldevtools-component)
  - [Editor Integrations](#editor-integrations)
    - [`Repl.MonacoProvider` and `Repl.MonacoEditor` Component](#replmonaco-provider-and-replmonaco-editor)
    - [`Repl.ShikiEditor` Component](#replshiki-editor)
- [Hooks](#hooks)
  - [`useRuntime`](#useRuntime)
- [Internal APIs Documentation](#internal-apis-documentation)
  - [`Runtime`](#runtime)
  - [`FileSystem`](#filesystem)
  - [`JsFile` and `CssFile`](#jsfile-and-cssfile)
  - [`FrameRegistry`](#frameregistry)
  - [`TypeRegistry`](#typeregistry)
- [Examples](#examples)
  - [Simple Example](#simple-example)
  - [Advanced Example](#advanced-example)
- [Acknowledgements](#acknowledgements)

## Installation

Import package from package manager.

```bash
npm install `@bigmistqke/repl`
yarn add `@bigmistqke/repl`
pnpm install `@bigmistqke/repl`
```

# Components Documentation

## `Repl` Component

Initializes the Repl environment by dynamically loading the required libraries (`Babel`, `TypeScript` and `monaco-editor`) and any Babel presets/plugins defined in the props. Configures and instantiates [`Runtime`](#runtime), which sets up [`FileSystem`](#filesystem), [`TypeRegistry`](#typeregistry) and [`FrameRegistry`](#frameregistry). The component ensures no children are rendered until all dependencies are fully loaded and the optionally provided `onSetup`-prop has been resolved.

It provides access for its descendants to its internal [`Runtime`](#runtime) through the [`useRuntime`](#useRuntime)-hook.

**Usage**

```tsx
<Repl
  typescript={{
    resolveJsonModule: true,
    esModuleInterop: true,
    ...
  }}
  initialState={{
    files: {
      // Add 2 files to the virtual file-system.
      sources: {
        // One exporting a sum-function.
        'src/sum.ts': `export const sum = (a: number, b: number) => a + b`,
        // Another importing this function and exporting a subtract-function.
        'src/index.ts': `import { sum } from "./sum";
          export const sub = (a: number, b: number) => sum(a, b * -1)`,
      }
    }
  }}
  class={styles.repl}
  onSetup={({ fileSystem }) => {
    createEffect(async () => {
      // Get the module-url of the File at a given path.
      const moduleUrl = fileSystem.get('src/index.ts')?.moduleUrl()
      if (!moduleUrl) return
      // Import the subtract-function of the module.
      const { sub } = await import(moduleUrl)
      // Call the function.
      console.log(sub(2, 1)) // Will log 1
    })
  }}
>
```

**Props**

- **babel**: Configuration for Babel transformations.
  - `presets`: Array of string identifiers for Babel presets.
  - `plugins`: Array of plugins or strings for Babel transformations.
- **cdn**: Cdn to import external dependencies from, defaults to `esm.sh`.
- **initialState**: Defines the initial state of the filesystem with predefined files and content.
  - `files`:
    - `sources`: Record of virtual path and source-code (`.js`/`.jsx`/`.ts`/`.tsx`/`.css`).
    - `alias`: Record of package-name and virtual path.
  - `types`:
    - `sources`: Record of virtual path and source-code (`.d.ts`).
    - `alias`: Record of package-names and virtual path.
- **mode**: Theme mode for the editor, either `light` or `dark`.
- **onSetup**:
  - A function that runs after the editor setup is complete. It allows access to the [`Runtime`](#runtime) for custom initialization scripts; for example pre-loading a local package.
  - The initial file-system state will only be processed after this callback returns. **_This callback can be async._**
- **typescript**: Configuration options for the TypeScript compiler, equal to `tsconfig.json`.

**Type**

```ts
type ReplProps = ComponentProps<'div'> & Partial<ReplConfig>

type ReplConfig = {
  babel: {
    presets: string[]
    plugins: (string | babel.PluginItem)[]
  }
  cdn: string
  initialState: {
    files: {
      sources: Record<string, string>
      alias: Record<string, string>
    }
    types: {
      sources: Record<string, string>
      alias: Record<string, string[]>
    }
  }
  mode: 'light' | 'dark'
  onSetup: (replContext: Runtime) => Promise<void> | void
  typescript: TypescriptConfig
  actions?: {
    saveRepl?: boolean
  }
}
```

## `Repl.Frame` Component

Manages individual `<iframe/>` containers for isolated execution environments.

**Usage**

```tsx
<Repl.Frame
  style={{ flex: 1 }}
  name="frame-2"
  bodyStyle={{
    padding: '0px',
    margin: '0px',
  }}
/>
```

**Props**

- **name**: An identifier for the (`Frame`)(#frame). Defaults to `default`.
- **bodyStyle**: CSS properties as a string or JSX.CSSProperties object to apply to the `<iframe/>` body.

**Type**

```tsx
type FrameProps = ComponentProps<'iframe'> &
  Partial<{
    name: string
    bodyStyle: JSX.CSSProperties | string
  }>
```

## `Repl.DevTools` Component

`Repl.DevTools` embeds an iframe to provide a custom Chrome DevTools interface for debugging purposes. This component connects to a `Repl.Frame` with the same `name` prop to display and interact with the frame's runtime environment, including console outputs, DOM inspections, and network activities.

**Usage**

```tsx
// To debug a frame named 'exampleFrame':
<Repl.Frame name="exampleFrame" />
<Repl.DevTools name="exampleFrame" />
```

**Props**

- **props**: Props include standard iframe attributes and a unique `name` used to link the DevTools with a specific `Repl.Frame`.

**Type**

```tsx
type ReplDevToolsProps = ComponentProps<'iframe'> & { name: string }
```

**Returns**

- Returns the iframe element that hosts the embedded Chrome DevTools, connected to the specified `Repl.Frame`.

**Example**

```tsx
// Example usage to integrate the DevTools with a named frame:
<Repl.Frame name="exampleFrame" />
<Repl.DevTools name="exampleFrame" />
```

## `Repl.TabBar` Component

A minimal wrapper around `<For/>` to assist with navigating between different files opened in the editor.

**Usage**

```tsx
<Repl.TabBar style={{ flex: 1 }}>
  {({ path }) => <button onClick={() => setCurrentPath(path)}>{path}</button>}
</Repl.TabBar>
```

**Props**

- **children**: A callback with the `path` and the corresponding [`File`](#jsfile-and-cssfile) as arguments. Expects a `JSX.Element` to be returned.
- **paths**: An array of strings to filter and sort existing paths.

**Type**

```ts
type TabBarProps = ComponentProps<'div'> & {
  children: (arg: { path: string; file: File | undefined }) => JSXElement
  paths: string[]
}
```

## Editor Integrations

### `Repl.MonacoProvider` and `Repl.MonacoEditor` Component

`Repl.MonacoEditor` embeds a `monaco-editor` instance for editing files. It has integrated type-support: with auto-completions and type-checking.

`Repl.MonacoProvider` initializes `Monaco` and provides it to its descendates through context. This allows multiple monaco-editors to share a single `Monaco`-instance. All `Repl.MonacoEditor` should be descendants of `Repl.MonacoProvider`.

**Usage**

```tsx
<Repl.MonacoProvider>
  <Repl.MonacoEditor
    style={{ flex: 1 }}
    path={currentPath()}
    onMount={editor => {
      createEffect(on(currentPath, () => editor.focus()))
    }}
  />
</Repl.MonacoProvider>
```

**Props**

- **path**: The file path in the virtual file system to bind the editor to.
- **onMount**: Callback function that executes when the editor is mounted, with the current `monaco-editor` as argument.

**Type**

```tsx
type EditorProps = ComponentProps<'div'> & {
  path: string
  onMount?: (editor: MonacoEditor) => void
}
```

### `Repl.ShikiEditor` Component

`Repl.ShikiEditor` is a small editor powered by [`shiki`](https://github.com/shikijs/shiki), a syntax highlighting library based on [`TextMate`](https://github.com/microsoft/vscode-textmate) grammar.

Unlike [`Repl.MonacoEditor`](#replmonacoprovider-and-replmonacoeditor-component), `Repl.ShikiEditor` does not provide type-checking or any type-information. It is therefore less suited for a playground, but can be useful for more minimal experiences (articles, documentation, ...).

**Usage**

```tsx
<Repl.ShikiEditor style={{ flex: 1 }} path={currentPath()} />
```

**Props**

- **path**: The file path in the virtual file system to bind the editor to.
- **themes**: A light/dark shiki-theme

**Type**

```tsx
type EditorProps = ComponentProps<'div'> & {
  path: string
  onMount?: (editor: MonacoEditor) => void
}
```

# Hooks

## `useRuntime`

Hook to interact with the internal [`Runtime`](#runtime) of `@bigmistqke/repl`. This class contains the virtual [`FileSystem`](#filesystem), [`TypeRegistry`](#typeregistry) and [`FrameRegistry`](#frameregistry).

This hook should be used in a descendant of [`Repl`](#repl-component), otherwise it will throw.

**Usage**

```ts
const { frameRegistry, fileSystem } = useRuntime()

const frame = frameRegistry.get('default')
const entry = fileSystem.get('src/index.ts')

frame?.injectFile(entry)
```

**Type**

```ts
type useRuntime = (): Runtime
```

# Internal APIs Documentation

## Runtime

### Overview

The `Runtime` class serves as the central coordination point of the `Repl` environment, integrating essential libraries and configurations necessary for its operation. It orchestrates interactions between various subsystems, including the file system, frame registry, type management, and code transpilation. This setup ensures a cohesive and efficient development environment within the browser.

**Key Methods and Properties**

- **config**: Configurations for the runtime environment that ensure mandatory settings like 'cdn' are always included. The 'cdn' is crucial for loading external libraries such as TypeScript.
- **fileSystem**: Manages file operations within the virtual file system. It is responsible for creating, retrieving, managing, and manipulating files and directories. See [`FileSystem`](#file-system).
- **frameRegistry**: Handles the registration and management of iframe containers for isolated code execution. This is crucial for maintaining security and stability by sandboxing different parts of code execution. See [`FrameRegistry`](#frame-registry).
- **typeRegistry**: Manages TypeScript type definitions within the system. This component is essential for providing accurate type information, enhancing code quality and IntelliSense in the editor. See [`TypeRegistry`](#type-registry).
- **import**: Manages the import of modules and dependencies from URLs or package names, streamlining the integration of external libraries and frameworks. see [`Import`](#importutils).
- **transpiler**: Utilizes Babel and Typescript to transform code according to specified typescript-config, babel-presets and -plugins.
- **toJSON(): RuntimeState**: Serializes the current state of the REPL into a JSON format. This method is useful for saving the state of the environment for later restoration or sharing.
- **initialize(state: RuntimeState)**: Sets up the initial state of the file system and type registry based on provided configurations. This method ensures that all necessary files and types are preloaded and ready for use.
- **download(name = 'repl.config.json')**: Allows users to download the current state of the REPL as a JSON file. This functionality is helpful for backing up configurations or sharing them with others. The default filename is `repl.config.json`, but it can be customized.

**Type**

```ts
class Runtime {
  constructor(
    public libs: {
      typescript: Ts,
      babel: Babel,
      babelPresets: any[],
      babelPlugins: Babel.PluginItem[]
    },
    config: ReplConfig,
  )

  config: Mandatory<ReplConfig, 'cdn'>
  fileSystem: FileSystem
  frameRegistry: FrameRegistry
  typeRegistry: TypeRegistry
  import: Import
  transpiler: Transpiler

  initialize(): void
  toJSON(): ReplState
  download(name: string = 'repl.config.json'): void
  mapModuleDeclarations(path: string, code: string, callback: Function): string | undefined
}
```

### Import

The `Import` utility-class facilitates the importation of external packages into the REPL environment by managing the fetching and parsing of a `package.json` file. This utility class enables importing dependencies that are not uploaded to an esm-friendly cdn like [`esm.sh`](www.esm.sh). This class is available from `Runtime.import`

#### Key Properties and Methods

- **fromPackageJson(url: string)**: Asynchronously imports a package by parsing its `package.json` from the specified URL. This method oversees the entire process from fetching the `package.json`, parsing it, resolving paths, loading scripts, and integrating type definitions, ensuring all components are properly configured within the REPL environment.

#### Usage Example

```tsx
const runtime = useRuntime()
runtime.import.fromPackageJson('https://example.com/package.json')
```

This method is particularly useful for dynamically loading packages that are not pre-bundled with the application, allowing for a more flexible and expandable development environment.

#### Types

```typescript
class Import {
  packageJsonParser: PackageJsonParser

  constructor(public runtime: Runtime) {}

  async fromPackageJson(url: string): Promise<void> {
    // Implementation details...
  }
}
```

### Transpiler

The `Transpiler` utility-class within the REPL environment is designed to manipulate and transform TypeScript module declarations within the provided code. It is used internally to modify import-paths and . This class is available from `Runtime.transpiler`

#### Key Properties and Methods

- **transformModuleDeclarations(code: string, callback: Function)**: Transforms module declarations within a TypeScript file based on a provided callback function. This method allows for significant flexibility in modifying, adding, or removing parts of the code dynamically.

#### Usage Example

```tsx
const runtime = useRuntime()
const updatedCode = runtime.transpiler.transformModuleDeclarations(originalCode, node => {
  if (node.moduleSpecifier.text.includes('old-path')) {
    node.moduleSpecifier.text = 'new-path'
  }
})
```

#### Types

```typescript
class Transpiler {
  constructor(private runtime: Runtime) {}

  transformModuleDeclarations(
    code: string,
    callback: (node: ts.ImportDeclaration | ts.ExportDeclaration) => void | false,
  ): string | undefined {
    // Transformation logic...
  }
}
```

The `transformModuleDeclarations` method actively scans and modifies import/export declarations based on the criteria defined in the callback. The callback can directly modify the nodes by returning updated nodes, or it can remove nodes by returning `false`. If an exception is thrown within the callback, it halts further execution, providing a fail-safe mechanism to prevent runtime errors from propagating.

The `fromPackageJson` method actively resolves paths, fetches content, and transforms module declarations to ensure that the imported modules are fully compatible and integrated into the REPL environment.

## `FileSystem`

The `FileSystem` API manages a virtual file system, allowing for the creation, retrieval, and manipulation of files as well as handling imports and exports of modules within the monaco-editor environment.

**Key Methods and Properties**

- **create(path: string)**: Creates and returns a new [`File`](#jsfile-and-cssfile) instance at the specified path.
- **get(path: string)**: Retrieves a [`File`](#jsfile-and-cssfile) instance by its path.
- **has(path: string)**: Checks if a [`File`](#jsfile-and-cssfile) exists at the specified path.
- **resolve(path: string)**: Resolves a path according to TypeScript resolution rules, supporting both relative and absolute paths. Returns [`File`](#jsfile-and-cssfile) or `undefined`.
- **importFromPackageJson(url: string)**: Imports a package from a specified URL by parsing its package.json.
- **initialize()**: Initializes the file system with the specified initial state, including preloading files and setting aliases.

**Type**

```ts
class FileSystem {
  constructor(
    public repl: Runtime,
  )

  alias: Record<string, string>
  config: ReplConfig
  packageJsonParser: PackageJsonParser
  typeRegistry: TypeRegistry

  addProject(files: Record<string, string>): void
  all(): Record<string, File>
  create(path: string): File
  get(path: string): File | undefined
  has(path: string): boolean
  importFromPackageJson(url: string): Promise<void>
  initialize(): void
  resolve(path: string): File | undefined
  toJSON(): {
    files: {
      sources: Record<string, string>
      alias: Record<string, string>
    }
    types: {
      sources: Record<string, string>
      alias: Record<string, string[]>
    }
  }
}
```

## File and Module Management in @bigmistqke/repl

`@bigmistqke/repl` efficiently handles JavaScript and CSS files with a sophisticated module system, integrating seamlessly into the browser's execution environment.

### JsFile

`JsFile` extends the abstract `File` class and associates with a `JsModule`, managing JavaScript files within the virtual file system.

**Key Methods and Properties:**

- **module**: Linked to a `JsModule` for handling JavaScript execution specifics.
- **get()**: Retrieves the current source code.
- **set(value: string)**: Updates the source code.
- **toJSON()**: Serializes the source code to a JSON-compatible string.

**Type:**

```typescript
class JsFile extends File {
  module: JsModule
  constructor(runtime: Runtime, path: string) {}
}
```

### CssFile

`CssFile` extends from `File` and is linked to a `CssModule`, specializing in CSS file management.

**Key Methods and Properties:**

- **module**: Associated with a `CssModule` for CSS management.
- **get()**: Retrieves the current CSS content.
- **set(value: string)**: Updates the CSS content.
- **toJSON()**: Returns the CSS content as a JSON-compatible string.

**Type:**

```typescript
class CssFile extends File {
  module: CssModule
  constructor(path: string) {}
}
```

### JsModule

`JsModule` represents a JavaScript module within the runtime, extending the generic `Module` class. It is responsible for transpilation and execution of JavaScript code, managing dependencies, and handling CSS imports.

**Key Methods and Properties:**

- **generate()**: Generates a new URL for an ES Module based on current source code.
- **url**: Retrieves the currently active module URL.
- **dispose(frame: Frame)**: Cleans up module-specific artifacts or bindings from the provided frame.

**Type:**

```typescript
class JsModule extends Module {
  generate: Accessor<string | undefined>
  url: string | undefined
  constructor(runtime: Runtime, file: JsFile) {}
}
```

### CssModule

`CssModule` manages CSS content, transpiling stylesheets into executable JavaScript modules that dynamically apply styles within the document.

**Key Methods and Properties:**

- **generate()**: Generates executable JavaScript to apply styles dynamically.
- **url**: Retrieves the currently active stylesheet URL.
- **dispose(frame: Frame)**: Removes the style element from the document.

**Type:**

```typescript
class CssModule extends Module {
  generate: Accessor<string | undefined>
  url: string | undefined
  constructor(file: CssFile) {}
}
```

## `FrameRegistry`

Manages a registry of [`Frame`](#frame) instances, each associated with its distinct `Window`. This class handles the creation, retrieval, and management of [`Frame`](#frame) instances.

### Key Methods and Properties

- **add(name: string, window: Window)**: Adds a new [`Frame`](#frame) with the given name and window reference.
- **delete(name: string)**: Removes a [`Frame`](#frame) from the registry.
- **get(name: string)**: Retrieves a [`Frame`](#frame) by name.
- **has(name: string)**: Checks if a [`Frame`](#frame) exists by name.

```ts
class FrameRegistry {
  add(name: string, window: Window): void
  delete(name: string): void
  get(name: string): Frame
  has(name: string): boolean
}
```

## `Frame`

Represents an individual `<iframe/>` within the application. It offers method to inject and execute Javascript and CSS code into its `Window`.

### Key Methods and Properties

- **injectFile(file: File)**: Injects the moduleUrl of a given [`File`](#jsfile-and-cssfile) into the frame

```ts
class Frame {
  constructor(public window: Window)
  injectFile(file: File): HTMLScriptElement | undefined
  dispose(file: File): void
}
```

## Type Registry

The `TypeRegistry` class manages TypeScript type definitions across the application, enhancing the editor's IntelliSense by maintaining accurate type information and resolving type definitions from various sources.

### Key Methods and Properties

- **initialize(initialState: Partial<TypeRegistryState>)**: Initializes the registry with predefined types and aliases.
- **toJSON()**: Converts the current state of the registry into a JSON object for serialization.
- **aliasPath(packageName: string, virtualPath: string)**: Maps a package name to an aliased path.
- **set(path: string, value: string)**: Adds or updates a type definition in the registry.
- **has(path: string)**: Checks if a type definition is already registered.

### Types

```typescript
type TypeRegistryState = {
  alias: Record<string, string[]>
  sources: Record<string, string>
}

class TypeRegistry {
  sources: Record<string, string>
  alias: Record<string, string[]>
  import: TypeImport

  constructor(runtime: Runtime) {}
}
```

## Type Import Utilities

`TypeImport` assists the `TypeRegistry` by importing type definitions from URLs or package names, ensuring that types are only fetched and cached as needed to avoid unnecessary network requests.

### Key Methods and Properties

- **fromUrl(url: string, packageName?: string)**: Imports type definitions from a URL if they are not already cached.
- **fromPackageName(packageName: string)**: Imports type definitions based on a package name by resolving it to a CDN path.
- **initialize(initialState: Partial<TypeRegistryState>)**: Caches the initial state of type sources and aliases to prevent re-fetching.

### Types

```typescript
class TypeImport {
  private cachedUrls: Set<string>
  private cachedPackageNames: Set<string>

  constructor(runtime: Runtime, typeRegistry: TypeRegistry) {}

  async fromUrl(url: string, packageName?: string): Promise<void>
  async fromPackageName(packageName: string): Promise<void>
}
```

# Examples

## Simple Example

This basic example illustrates the core functionality of setting up a TypeScript playground using @bigmistqke/repl. It demonstrates how to initialize the REPL environment, load a simple TypeScript file, and execute a function from it within the browser. This example is ideal for those new to @bigmistqke/repl, showcasing how straightforward it is to get started with creating browser-based development environments. For a more interactive experience, check out the live demo.

```tsx
<Repl
  // Initialize repl-state
  initialState={{
    files: {
      'src/index.ts': 'export const greet = (): string => "Hello, world!";',
    },
  }}
  onSetup={({ fileSystem }) => {
    // Get file from file-system
    const file = fileSystem.get('src/index.ts')
    // Get esm-url from file
    const moduleUrl = file?.module.url()
    // Import module and call its function
    import(moduleUrl).then(module => console.log(module.greet()))
  }}
/>
```

## Advanced Example

This application demonstrates complex interactions between various components and hooks, designed to facilitate an interactive and intuitive coding environment directly in the browser. Click [here](https://bigmistqke.github.io/repl/) for a live-demo.

```tsx
import { Repl, useRuntime, JsFile } from '@bigmistqke/repl'
import { solidReplPlugin } from '@bigmistqke/repl/plugins'
import { createEffect, createSignal, mapArray, on, onCleanup } from 'solid-js'
import { JsxEmit } from 'typescript'

// Main component defining the application structure
const App = () => {
  // State management for the current file path, initialized to 'src/index.tsx'
  const [currentPath, setCurrentPath] = createSignal('src/index.tsx')

  // Setting up the editor with configurations for Babel and TypeScript
  return (
    <Repl
      babel={{
        // Babel preset for SolidJS
        presets: ['babel-preset-solid'],
        // Plugin to enhance SolidJS support in Babel
        plugins: [solidReplPlugin],
      }}
      typescript={{
        // Preserve JSX to be handled by another transformer (e.g., Babel)
        jsx: JsxEmit.Preserve,
        // Specify the JSX factory functions import source
        jsxImportSource: 'solid-js',
        // Enable all strict type-checking options
        strict: true,
      }}
      // Initialize repl's state
      initialState={{
        files: {
          'src/index.css': `body { background: blue; }`,
          'src/index.tsx': `import { render } from "solid-js/web";
            import "./index.css"
            const Counter = () => {
              const [count, setCount] = createSignal(0)
              const increment = () => setCount(count => count + 1)
              return <button onClick={increment}>{count()}</button>
            }
            render(Counter, document.body)`,
        },
      }}
      // CSS class for styling the Repl container-component
      class={styles.repl}
      // Event called when all dependencies are loaded
      onSetup={async ({ fileSystem, frameRegistry }) => {
        createEffect(() => {
          // Access the default frame
          const frame = frameRegistry.get('default')
          if (!frame) return

          // Get the current main file
          const entry = fs.get(currentPath())
          if (entry instanceof JsFile) {
            // Inject the JS file into the iframe for execution
            frame.injectFile(entry)

            // Cleanup action to remove injected scripts on component unmount
            onCleanup(() => frame.window.dispose?.())

            // Process CSS imports and inject them into the iframe
            createEffect(
              mapArray(entry.cssImports, css => createEffect(() => frame.injectFile(css))),
            )
          }
        })
      }}
    >
      <div style={{ overflow: 'hidden', display: 'flex', 'flex-direction': 'column' }}>
        <Repl.TabBar class={{ display: 'flex' }}>
          {({ path }) => <button onClick={() => setCurrentPath(path)}>{path}</button>}
        </Repl.TabBar>
        <Repl.Editor style={{ flex: 1 }} path={currentPath()} />
      </div>
      <Repl.Frame
        style={{ flex: 1 }}
        bodyStyle={{ padding: '0px', margin: '0px' }} // Style for the iframe body
      />
    </Repl>
  )
}

export default App
```

# Acknowledgements

The main inspiration of this project is my personal favorite IDE: [solid-playground](https://github.com/solidjs/solid-playground). Some LOC are copied directly, p.ex the css- and js-injection into the iframe.
