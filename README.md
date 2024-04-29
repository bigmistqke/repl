<p>
  <img width="100%" src="https://assets.solidjs.com/banner?type=@bigmistqke/repl&background=tiles&project=%20" alt="@bigmistqke/repl">
</p>

# @bigmistqke/repl

This SolidJS component library enables the creation of modular, headless TypeScript playgrounds utilizing the Monaco Editor. It supports a flexible file system for transpiling TypeScript into ECMAScript Modules (ESM) and manages automatic type imports, making it ideal for developers to create customizable, browser-based IDEs.

## Features

- **Monaco Editor Integration**: Utilize the powerful Monaco Editor for sophisticated web-based code editing.
- **Comprehensive TypeScript Support**: Includes full integration with TypeScript, providing syntax highlighting and error checking.
- **Real-time Transpilation**: Direct transpilation of TypeScript code into ESM, allowing for immediate feedback.
- **Automatic Type Imports**: Streamline coding with automatic type discovery and import.
- **Theme Flexibility**: Supports both dark and light themes, easily switchable to suit preferences.
- **Advanced File System Management**: Robust management of file states and operations within the editor.
- **Configurable Build and Runtime Options**: Easily configurable TypeScript compiler settings and other operational parameters.

## Installation

Begin by cloning the repository and installing the necessary dependencies:

```bash
pnpm install `@bigmistqke/repl`
```

# Components Documentation

## `Repl` Component

The `Repl` component integrates the Monaco Editor into a SolidJS application, facilitating TypeScript editing and transpilation.

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
      'src/sum.ts': `export const sum = (a: number, b: number) => a + b`,,
      'src/index.ts': `import { sum } from "./sum";
        export const sub = (a: number, b: number) => sum(a, b * -1)`,
    },
  }}
  class={styles.repl}
  onSetup={async ({ fs, frames }) => {
    createEffect(() => {
      const sub = fs.get('src/index.ts').getModuleUrl()
      console.log(sub(2, 1)) // 1
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
  - `file`: Record of virtual path and source-code (`.js`/`.jsx`/`.ts`/`.tsx`/`.css`).
  - `alias`: Record of package-name and virtual path.
  - `types`:
    - `file`: Record of virtual path and source-code (`.d.ts`).
    - `alias`: Record of package-names and virtual path.
- **mode**: Theme mode for the editor ('light' or 'dark').
- **onSetup**: A function that runs after the editor setup is complete. It allows for custom initialization scripts, accessing filesystem and frame registry. The initial file-system state will only be processed after this callback returns. This callback can be async.
- **typescript**: Configuration options for the TypeScript compiler, equal to `tsconfig.json`.

**Type**

```ts
type ReplProps = ComponentProps<'div'> &
  Partial<{
    babel: {
      presets: string[]
      plugins: (string | babel.PluginItem)[]
    }
    cdn: string
    initialState: {
      files: Record<string, string>
      alias: Record<string, string>
      types: {
        files: Record<string, string>
        alias: Record<string, string>
      }
    }
    mode: 'light' | 'dark'
    onSetup: (event: { fs: FileSystem; frames: FrameRegistry }) => Promise<void> | void
    typescript: TypescriptConfig
    actions?: {
      saveRepl?: boolean
    }
  }>
```

## `Repl.Editor` Component

A sub-component of `Repl` that represents an individual editor pane where users can edit files.

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
- **onMount**: Callback function that executes when the editor is mounted.

**Type**

```ts
type EditorProps = ComponentProps<'div'> & {
  path: string
  onMount?: (editor: MonacoEditor) => void
}
```

## `Repl.Frame` Component

Manages individual iframe containers for isolated execution environments.

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

- **name**: An identifier for the frame, used in the frame registry. Defaults to `default`.
- **bodyStyle**: CSS properties as a string or JSX.CSSProperties object to apply to the iframe body.

**Type**

```ts
type FrameProps = ComponentProps<'iframe'> &
  Partial<{
    name: string
    bodyStyle: JSX.CSSProperties | string
  }>
```

## `Repl.TabBar` Component

A minimal wrapper around `<For/>` to assist with navigating between different files opened in the editor.

**Usage**

```jsx
<Repl.TabBar style={{ flex: 1 }}>
  {({ path }) => <button onClick={() => setCurrentFile(path)}>{path}</button>}
</Repl.TabBar>
```

**Props**

- **children**: A callback with the `path` and the corresponding `File` as arguments. Expects a `JSX.Element` to be returned.
- **paths**: Filter and sort existing paths.

**Type**

```ts
type TabBarProps = ComponentProps<'div'> & {
  children: (arg: { path: string; file: File | undefined }) => JSXElement
  paths: string[]
}
```

# Internal APIs Documentation

## `FileSystem`

The `FileSystem` API manages a virtual file system, allowing for the creation, retrieval, and manipulation of files as well as handling imports and exports of modules within the editor environment.

**Key Methods and Properties**

- **create(path: string)**: Creates and returns a new `File` instance at the specified path.
- **get(path: string)**: Retrieves a `File` instance by its path.
- **has(path: string)**: Checks if a file exists at the specified path.
- **resolve(path: string)**: Resolves a path according to TypeScript resolution rules, supporting both relative and absolute paths.
- **addPackage(url: string)**: Adds a package by URL, analyzing and importing its contents into the virtual file system.
- **initialize()**: Initializes the file system with the specified initial state, including preloading files and setting aliases.

**Type**

```ts
class FileSystem {
  alias: Record<string, string>
  config: ReplConfig
  packageJsonParser: PackageJsonParser
  typeRegistry: TypeRegistry

  constructor(
    public monaco: Monaco,
    config: ReplConfig,
  )

  initialize(): void
  toJSON(): {
    files: Record<string, string>
    alias: Record<string, string>
    types: {
      files: Record<string, string>
      alias: Record<string, string>
    }
  }
  download(name = 'repl.config.json') : void
  create(path: string): File
  has(path: string): boolean
  get(path: string): File | undefined
  addProject(files: Record<string, string>): void
  addPackage(url: string): Promise<void>
  resolve(path: string): File | undefined
  all(): Record<string, File>
}
```

## `JsFile` and `CssFile`

These classes represent JavaScript and CSS files within the virtual file system, respectively. Both extend from the abstract `File` class, which provides basic file operations and model management.

**Key Methods and Properties**

- **set(value: string)**: Sets the content of the file.
- **get()**: Retrieves the content of the file.
- **model**: The Monaco editor model associated with the file.
- **moduleUrl**: A URL to an esm-module of the transpiled content of the file.
- **toJSON()**: Serializes the file's content.

**types**

```ts
class JsFile extends File {
  model: Model
  set(value: string): void
  get(): string
  moduleUrl(): string | undefined
  cssImports: Accessor<CssFile[]>
}

class CssFile extends File {
  model: Model
  set(value: string): void
  get(): string
  moduleUrl(): string | undefined
}
```

## `FrameRegistry`

Manages individual iframe containers used for isolated execution environments. This registry is used to manage and reference multiple frames, allowing files to be injected into specific frames.

### Key Methods and Properties

- **add(name: string, window: Window)**: Adds a new frame with the given name and window reference.
- **get(name: string)**: Retrieves a frame by name.
- **has(name: string)**: Checks if a frame exists by name.
- **delete(name: string)**: Removes a frame from the registry.

```ts
class FrameRegistry {
  private frames: Record<string, Frame>;
  add(name: string, window: Window): void;
  get(name: string): Frame;
  has(name: string): boolean;
  delete(name: string): void;
  ...
}
```

## `TypeRegistry`

Handles the management and storage of TypeScript types across the application. This registry is crucial for maintaining consistency in type definitions and ensuring accurate type checking and autocomplete functionalities within the editor.

**Key Methods and Properties**

- **importTypesFromUrl(url: string, packageName?: string)**: Imports types from a specified URL, optionally associating them with a package name.
- **importTypesFromPackageName(packageName: string)**: Imports types based on a package name, resolving to CDN paths and managing version conflicts.
- **initialize(initialState: TypeRegistryState)**: Initializes the registry with a predefined state, setting up known types and aliases.
- **toJSON()**: Serializes the current state of the registry for persistence or debugging.

**types**

```ts
export class TypeRegistry {
  packageJson = new PackageJsonParser()
  constructor(public fs: FileSystem)

  toJSON(): {
    files: Record<string, string>,
    types: Record<string, [string]>,
  }
  initialize(initialState: TypeRegistryState): void
  aliasPath(packageName: string, virtualPath: string): void
  importTypesFromUrl(url: string, packageName?: string): Promise<Void>
  importTypesFromPackageName(packageName: string): Promise<void>
}

```

# Advanced Example: Integrating Monaco Editor with SolidJS

This chapter provides an in-depth look at a sophisticated example of integrating the Monaco Editor within a SolidJS application. The application is designed to offer a dynamic development environment with features like live TypeScript editing, file management, and execution within a secure, isolated context.

## Application Overview

This application demonstrates complex interactions between various components and hooks, designed to facilitate an interactive and intuitive coding environment directly in the browser.

### Components and Their Interactions

- **`Repl`**: Main component setting up the editor.
- **`useRepl`**: Hook to interact with REPL state and functionalities.
- **`Resizable`**: Component that allows dynamic resizing of the editor and output panels.
- **`JsFile` and `CssFile`**: File abstractions within the virtual file system.

### Detailed Code Explanation

```ts
// Main component defining the application structure
const App: Component = () => {
  // State management for the current file path, initialized to 'src/index.tsx'
  const [currentPath, setCurrentFile] = createSignal('src/index.tsx')

  // Button component for adding new files dynamically to the REPL environment
  const AddButton = () => {
    const repl = useRepl() // Access the REPL context for filesystem operations

    return (
      <button
        onClick={() => {
          let index = 1
          let path = `src/index.tsx`
          // Check for existing files and increment index to avoid naming collisions
          while (repl.fs.has(path)) {
            path = `src/index${index}.tsx`
            index++
          }
          // Create a new file in the file system and set it as the current file
          repl.fs.create(path)
          setCurrentFile(path)
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
      class={styles.repl} // CSS class for styling the REPL component
      onSetup={async ({ fs, frames }) => {
        createEffect(() => {
          const frame = frames.get('default') // Access the default frame
          if (!frame) return

          const entry = fs.get('src/index.tsx') // Get the current main file
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
        /* await fs.addPackage('./solid-three') */
      }}
    >
      <Resizable style={{ width: '100vw', height: '100vh', display: 'flex' }}>
        <Resizable.Panel style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex' }}>
            <Repl.TabBar style={{ flex: 1 }}>
              {({ path }) => <button onClick={() => setCurrentFile(path)}>{path}</button>}
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
