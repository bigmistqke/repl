<p>
  <img width="100%" src="https://assets.solidjs.com/banner?type=@bigmistqke/repl&background=tiles&project=%20" alt="@bigmistqke/repl">
</p>

<h1 id="title">@bigmistqke/repl</h1>

`@bigmistqke/repl` provides unstyled building blocks to create TypeScript playgrounds directly in the browser, featuring adaptable editor integration. Currently, it supports both the feature-rich [`Monaco Editor`](#monaco-editor-integration) and the lighter [`Tm Editor`](#tm-editor-integration). It supports real-time transpilation of TypeScript into ECMAScript Modules (ESM) and facilitates seamless imports of external dependencies, including their type definitions, making it ideal for both quick prototyping and complex browser-based IDE development.

https://github.com/bigmistqke/repl/assets/10504064/50195cb6-f3aa-4dea-a40a-d04f2d32479d

**_Click [here](#example-overview) for a line-by-line explanation of the above example and [here](https://bigmistqke.github.io/repl/) for a live-demo._**

## Features

- **Modular Editor Integration**: Start with [`Monaco Editor`](#monaco-editor-integration) for a fully featured IDE-like experience or [`Tm Editor`](#tm-editor-integration) for a more minimal editor. The architecture is designed to accommodate additional editors as needed.
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
  - [___@bigmistqke/repl/solid/monaco___-editor](#bigmistqkerepleditormonaco)
  - [___@bigmistqke/repl/solid/tm-editor___](#bigmistqkerepleditorshiki)
- [___@bigmistqke/repl___](#bigmistqkereplruntime)
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

- **[@bigmistqke/repl](#bigmistqkereplruntime)**: Contains core runtime functionalities necessary for creating and managing the virtual environment within the repl.
- **[@bigmistqke/repl/element](/src/element/ELEMENT.md#bigmistqkereplelement)**: Entry to the core custom elements
- **[@bigmistqke/repl/element/monaco-editor](/src/element/ELEMENT.md#bigmistqkereplelementmonaco-editor)**: Integrates the Monaco editor, providing a rich coding environment.
- **[@bigmistqke/repl/element/tm-editor](/src/element/ELEMENT.md#bigmistqkereplelementtm-editor)**: Adds syntax highlighting through the Tm library.
- **[@bigmistqke/repl/solid](/src/solid/SOLID.md#bigmistqkereplsolid)**: Entry to the core solid components
- **[@bigmistqke/repl/solid/monaco-editor](/src/solid/SOLID.md#bigmistqkereplsolidmonaco-editor)**: Integrates the Monaco editor, providing a rich coding environment.
- **[@bigmistqke/repl/solid/tm-editor](/src/solid/SOLID.md#bigmistqkereplsolidtm-editor)**: Adds syntax highlighting through the Tm library.
- **[@bigmistqke/repl/plugins/rollup-service-worker](/src/plugins/PLUGINS.md#bigmistqkereplpluginsrollup-service-worker)**: Enhances the repl with service worker capabilities to efficiently manage caching.
- **[@bigmistqke/repl/plugins/babel-solid-repl](/src/plugins/PLUGINS.md#bigmistqkereplpluginsbabel-solid-repl)**: Provides plugins for Babel that are optimized for SolidJS applications.
- **[@bigmistqke/repl/transform/babel](/src/transform/TRANSFORM.md#bigmistqkerepltransformbabel)**: Supports the integration of Babel for dynamic JavaScript code transformation.
- **[@bigmistqke/repl/transform/typescript](/src/transform/TRANSFORM.md#bigmistqkerepltransformtypescript)**: Allows for the inclusion and use of the TypeScript compiler for code transformation.
- **[@bigmistqke/repl/transform-module-paths/typescript](/src/transform-module-paths/TRANSFORM_MODULE_PATHS.MD#bigmistqkerepltransform-module-pathstypescript)**: Offers utilities for managing and transforming module paths in TypeScript files, crucial for resolving imports and integrating external modules.

# @bigmistqke/repl

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

You can import and initialize the `Runtime` class from `@bigmistqke/repl`.

```ts
import { Runtime } from '@bigmistqke/repl'

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
      console.info('Sum of 1 and 2 is:', module.sum(1, 2));
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
import { MonacoEditor, MonacoTheme } from '@bigmistqke/repl/solid/monaco-editor'
import { babelSolidReplPlugin } from '@bigmistqke/repl/plugins/babel-solid-repl'
import vs_dark from '@bigmistqke/repl/solid/monaco-editor/themes/vs_dark_good.json'
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
