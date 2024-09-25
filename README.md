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

- **[@bigmistqke/repl](/src/runtime/RUNTIME.md#bigmistqkerepl)**: Contains core runtime functionalities necessary for creating and managing the virtual environment within the repl.
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
