<p>
  <img width="100%" src="https://assets.solidjs.com/banner?type=@bigmistqke/repl&background=tiles&project=%20" alt="@bigmistqke/repl">
</p>

# @bigmistqke/repl

`@bigmistqke/repl` provides unstyled building blocks to create TypeScript playgrounds utilizing the Monaco Editor. It supports a flexible file system for transpiling TypeScript into ECMAScript Modules (ESM), imports of external dependencies (including types), making it ideal for developers to create customizable, browser-based IDEs.

https://github.com/bigmistqke/repl/assets/10504064/50195cb6-f3aa-4dea-a40a-d04f2d32479d

**_Click [here](#example-overview) for a line-by-line explanation of the above example and [here](https://bigmistqke.github.io/repl/) for a live-demo._**

## Features

- **Monaco Editor Integration**: `vscode` like experience in-browser with Typescript support.
- **Real-time Transpilation**: Direct transpilation of TypeScript code into ESM, allowing for immediate feedback.
- **Automatic Imports of External Dependencies**: Streamline coding with automatic imports of external dependencies, including type definitions.
- **Flexible API**: Direct access to the internals and to the generated ESM Modules. Application can scale from a minimal playground to a feature-complete IDE.
- **Advanced File System Management**: Robust management of file states and operations within the editor.
- **Configurable Build and Runtime Options**: Easily configurable TypeScript compiler settings and integration with Babel-plugins/presets.

# Table of Contents

- [Installation](#installation)
- [Components Documentation](#components-documentation)
  - [`Repl` Component](#repl-component)
  - [`Repl.Editor` Component](#repleditor-component)
  - [`Repl.Frame` Component](#replframe-component)
  - [`Repl.TabBar` Component](#repltabbar-component)
- [Hooks](#hooks)
  - [`useRuntime`](#useRuntime)
- [Internal APIs Documentation](#internal-apis-documentation)
  - [`ReplContext`](#replcontext)
  - [`FileSystem`](#filesystem)
  - [`JsFile` and `CssFile`](#jsfile-and-cssfile)
  - [`FrameRegistry`](#frameregistry)
  - [`TypeRegistry`](#typeregistry)
- [Example Overview](#example-overview)
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

Initializes the Repl environment by dynamically loading the required libraries (`Babel`, `TypeScript` and `monaco-editor`) and any Babel presets/plugins defined in the props. Configures and instantiates [`ReplContext`](#replcontext), which sets up [`FileSystem`](#filesystem) and [`TypeRegistry`](#typeregistry). The component ensures no children are rendered until all dependencies are fully loaded and the optionally provided `onSetup`-prop has been resolved.

It provides access for its children to its internal [`ReplContext`](#replcontext) through the [`useRuntime`](#useRuntime)-hook.

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
  - A function that runs after the editor setup is complete. It allows access to the [`ReplContext`](#replcontext) for custom initialization scripts; for example pre-loading a local package.
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
  onSetup: (replContext: ReplContext) => Promise<void> | void
  typescript: TypescriptConfig
  actions?: {
    saveRepl?: boolean
  }
}
```

## `Repl.Editor` Component

`Repl.Editor` embeds a `monaco-editor` instance for editing files. It dynamically creates a [`File`](#file) instance in the virtual [`FileSystem`](#filesystem) based on the provided `path`-prop.

**Usage**

```tsx
<Repl.Editor
  style={{ flex: 1 }}
  path={currentPath()}
  onMount={editor => {
    createEffect(on(currentPath, () => editor.focus()))
  }}
/>
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

# Hooks

## `useRuntime`

Hook to interact with the internal api of `@bigmistqke/repl` through the [`ReplContext`](#replcontext). This class contains the virtual [`FileSystem`](#filesystem), [`TypeRegistry`](#typeregistry) and [`FrameRegistry`](#frameregistry).

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
type useRuntime = (): ReplContext
```

# Internal APIs Documentation

## `ReplContext`

The `ReplContext` class orchestrates the Repl environment, integrating libraries (`babel`, `typescript` and `monaco-editor`) and managing both the virtual [`FileSystem`](#filesystem) and type declarations through the [`TypeRegistry`](#typeregistry).

It is accessible from userland through the [`useRuntime`](#useRuntime)-hook.

**Key Methods and Properties**

- **initialize()**: Prepares the [`FileSystem`](#filesystem) and [`TypeRegistry`](#typeregistry) based on the initial configuration, handling the setup of files and types.
- **toJSON()**: Serializes the current state of the Repl into JSON format for storage or further manipulation.
- **download(name: string)**: Allows the downloading of the Repl's current state as a JSON file, facilitating easy sharing and persistence.
- **mapModuleDeclarations(path: string, code: string, callback: Function)**: Applies transformations to module declarations (imports/exports) within files based on the provided callback function.

**Type**

```ts
class ReplContext {
  constructor(
    public libs: {
      monaco: Monaco,
      typescript: Ts,
      babel: Babel,
      babelPresets: any[],
      babelPlugins: Babel.PluginItem[]
    },
    config: Partial<ReplConfig>,
  )

  // Cdn defaults to `esm.sh`
  config: Mandatory<ReplConfig, 'cdn'>
  fileSystem: FileSystem
  frameRegistry: FrameRegistry
  typeRegistry: TypeRegistry

  initialize(): void
  toJSON(): ReplState
  download(name = 'repl.config.json'): void
  mapModuleDeclarations(path: string, code: string, callback: Function): string | undefined
}
```

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
    public repl: ReplContext,
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

## `JsFile` and `CssFile`

These classes represent JavaScript and CSS files within the virtual file system, respectively. Both extend from the abstract [`File`](#jsfile-and-cssfile) class, which provides basic file operations and model management.

**Key Methods and Properties**

- **cachedModuleUrl**: A memoized URL for an ES Module, created from the file's source code.
- **dispose(frame: Frame)**: Runs a cleanup-function to remove any side-effects from the given [`Frame`](#frame).
  - `CssFile`: Removes stylesheet generated by the `CssFile` esm-module.
  - `JsFile`: Executes the cleanup function attached to `window.dispose` in the provided frame. `window.dispose` is either explicitly mentioned in the code, or it is added through a babel-transformation (see `solid-repl-plugin` of `@bigmistqke/repl/plugins`).
- **generateModuleUrl**: Generates a new URL for an ES Module based on the current source code of the file.
- **get()**: Retrieves the content of the file.
- **set(value: string)**: Sets the content of the file.
- **model**: The Monaco editor model associated with the file.
- **toJSON()**: Serializes the file's content.

**Types**

```ts
abstract class File {
  abstract model: Model

  abstract cachedModuleUrl(): string | undefined
  abstract generateModuleUrl(): string | undefined
  abstract get(): string
  abstract set(value: string): void
  abstract toJSON(): string
}
class JsFile extends File {
  // Accessor to the CssFiles that are imported in the current JsFile
  cssImports: Accessor<CssFile[]>
}
class CssFile extends File {}
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
}
```

## `TypeRegistry`

Manages the registry of TypeScript types across the application, facilitating type definition management. It provides utilities for importing recursively TypeScript definitions from either a package-name or a url.

This is used internally to auto-import the type-definitions of external dependencies.

**Key Methods and Properties**

- **importTypesFromUrl(url: string, packageName?: string)**: Imports types from a specified URL, optionally associating them with a package name.
- **importTypesFromPackageName(packageName: string)**: Imports types based on a package name, resolving to CDN paths and managing version conflicts.
- **toJSON()**: Serializes the current state of the type registry.

**Types**

```ts
export class TypeRegistry {
  constructor(public repl: ReplContext)

  importTypesFromUrl(url: string, packageName?: string): Promise<Void>
  importTypesFromPackageName(packageName: string): Promise<void>
  toJSON(): {
    sources: Record<string, string>,
    types: Record<string, [string]>,
  }
}

```

# Example Overview

This application demonstrates complex interactions between various components and hooks, designed to facilitate an interactive and intuitive coding environment directly in the browser. Click [here](https://bigmistqke.github.io/repl/) for a live-demo.

### Detailed Code Explanation

```tsx
import { Repl, useRuntime } from '@bigmistqke/repl'
import { solidReplPlugin } from '@bigmistqke/repl/plugins/solid-repl'
import { Resizable } from 'corvu/resizable'
import { createEffect, createSignal, mapArray, on, onCleanup } from 'solid-js'
import { JsFile } from 'src/logic/file'
import { JsxEmit } from 'typescript'

// Main component defining the application structure
const App = () => {
  // State management for the current file path, initialized to 'src/index.tsx'
  const [currentPath, setCurrentPath] = createSignal('src/index.tsx')

  // Button component for adding new files dynamically to the Repl environment
  const AddButton = () => {
    const repl = useRuntime() // Access the Repl context for filesystem operations

    return (
      <button
        onClick={() => {
          let index = 1
          let path = `src/index.tsx`
          // Check for existing files and increment index to avoid naming collisions
          while (repl.fileSystem.has(path)) {
            path = `src/index${index}.tsx`
            index++
          }
          // Create a new file in the file system and set it as the current file
          repl.fileSystem.create(path)
          setCurrentPath(path)
        }}
      >
        add file
      </button>
    )
  }

  // Setting up the editor with configurations for Babel and TypeScript
  return (
    <Repl
      babel={{
        presets: ['babel-preset-solid'], // Babel preset for SolidJS
        plugins: [solidReplPlugin], // Plugin to enhance SolidJS support in Babel
      }}
      typescript={{
        resolveJsonModule: true,
        esModuleInterop: true,
        noEmit: true, // Avoid emitting files during compilation
        isolatedModules: true, // Ensures each file can be transpiled independently
        skipLibCheck: true, // Skip type checking of all declaration files (*.d.ts)
        allowSyntheticDefaultImports: true,
        forceConsistentCasingInFileNames: true,
        noUncheckedIndexedAccess: true,
        paths: {}, // Additional paths for module resolution
        jsx: JsxEmit.Preserve, // Preserve JSX to be handled by another transformer (e.g., Babel)
        jsxImportSource: 'solid-js', // Specify the JSX factory functions import source
        strict: true, // Enable all strict type-checking options
      }}
      initialState={{
        files: {
          'src/index.css': `body { background: blue; }`, // Initial CSS content
          'src/index.tsx': `...JSX code...`, // Initial JS/JSX content
        },
      }}
      class={styles.repl} // CSS class for styling the Repl component
      onSetup={async ({ fileSystem, frameRegistry }) => {
        createEffect(() => {
          const frame = frameRegistry.get('default') // Access the default frame
          if (!frame) return

          const entry = fs.get(currentPath()) // Get the current main file
          if (entry instanceof JsFile) {
            frame.injectFile(entry) // Inject the JS file into the iframe for execution

            // Cleanup action to remove injected scripts on component unmount
            onCleanup(() => frame.window.dispose?.())

            // Process CSS imports and inject them into the iframe
            createEffect(
              mapArray(entry.cssImports, css => createEffect(() => frame.injectFile(css))),
            )
          }
        })
        // Optional: Load external packages dynamically
        /* await fs.importFromPackageJson('./solid-three/package.json') */
      }}
    >
      <Resizable style={{ width: '100vw', height: '100vh', display: 'flex' }}>
        <Resizable.Panel style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex' }}>
            <Repl.TabBar style={{ flex: 1 }}>
              {({ path }) => <button onClick={() => setCurrentPath(path)}>{path}</button>}
            </Repl.TabBar>
            <AddButton />
          </div>
          <Repl.Editor
            style={{ flex: 1 }}
            path={currentPath()}
            onMount={editor => {
              // Focus the editor on mount and whenever the current file path changes
              createEffect(on(currentPath, () => editor.focus()))
            }}
          />
        </Resizable.Panel>
        <Resizable.Handle />
        <Resizable.Panel style={{ display: 'flex' }}>
          <Repl.Frame
            style={{ flex: 1 }}
            bodyStyle={{ padding: '0px', margin: '0px' }} // Style for the iframe body
          />
        </Resizable.Panel>
      </Resizable>
    </Repl>
  )
}

export default App
```

# Acknowledgements

The main inspiration of this project is my personal favorite IDE: [solid-playground](https://github.com/solidjs/solid-playground). Some LOC are copied directly, p.ex the css- and js-injection into the iframe.
