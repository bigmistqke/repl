# @bigmistqke/repl

This module provides a separate export for the runtime of @bigmistqke/repl. While the `Runtime` class coordinates all internal operations, we also export internal classes to offer greater flexibility for users who need more granular control.

## Exports

- [Runtime](#runtime)
- [File](#file-abstract)
  - [JsFile](#jsfile)
  - [CssFile](#cssfile)
- [Module](#module-abstract)
  - [JsModule](#jsmodule)
  - [CssModule](#cssmodule)
- [FrameRegistry](#frameregistry)
- [Frame](#frame)
- [PackageJsonParser](#packagejsonparser)
- [TypeRegistry](#typeregistry)
- [TypeImportUtils](#typeimportutils)

## Runtime

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
  transformModulePaths: (
    source: string,
    callback: (value: string) => string | null,
  ) => string | undefined
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
    files: {
      /* initial file states */
    },
    types: {
      /* initial type states */
    },
  },
  transform: (source, path) => {
    /* transform code */
  },
  transformModulePaths: (source, callback) => {
    /* transform module paths */
  },
}

const runtime = new Runtime(runtimeConfig)
runtime.initialize()
```

## File Abstract

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

### JsFile

The `JsFile` class represents javascript and typescript files within the repl environment.

```typescript
class JsFile extends File {
  constructor(public runtime: Runtime, public path: string)

  /** Module associated with the JavaScript file. */
  module: JsModule
}
```

### CssFile

The `CssFile` class represents css files within the repl environment.

```typescript
class CssFile extends File {
  constructor(public runtime: Runtime, public path: string)

  /** Module associated with the JavaScript file. */
  module: CssModule
}
```

## Module Abstract

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

### JsModule

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

### CssModule

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

## FrameRegistry

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

## Frame

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

## PackageJsonParser

Parses the package.json file from a given base URL. Used internally by [`TypeImportUtils`](#typeimportutils).

```typescript
class PackageJsonParser {
  /** Fetches and parses the package.json file. Will throw if no valid entry is found.*/
  async parse(baseUrl: string): Promise<{
    typesUrl: string | undefined
    scriptUrl: string
    packageName: string
  }>
}
```

## TypeRegistry

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

## TypeImportUtils

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
