import { setRuntime } from '@bigmistqke/repl/custom-element'
import { setMonaco } from '@bigmistqke/repl/custom-element/monaco-editor'
import '@bigmistqke/repl/custom-element/shiki-editor'
import vs_dark from '@bigmistqke/repl/editor/monaco/themes/vs_dark_good.json'
import { CssModuleFile } from '@bigmistqke/repl/file-extra/css-module'
import { JsFile, Runtime } from '@bigmistqke/repl/runtime'
import { typescriptTransformModulePaths } from '@bigmistqke/repl/transform-module-paths/typescript'
import { babelTransform } from '@bigmistqke/repl/transform/babel'
import { typescriptTransform } from '@bigmistqke/repl/transform/typescript'
import loader from '@monaco-editor/loader'

import { createEffect, on, onCleanup, onMount, type Component } from 'solid-js'

const tsconfig = {
  target: 2,
  module: 5,
  jsx: 1,
  jsxImportSource: 'solid-js',
  esModuleInterop: true,
  allowSyntheticDefaultImports: true,
  forceConsistentCasingInFileNames: true,
  isolatedModules: true,
  resolveJsonModule: true,
  skipLibCheck: true,
  strict: true,
  noEmit: false,
  outDir: './dist',
}

const App: Component = () => {
  onMount(async () => {
    const transformModulePaths = await typescriptTransformModulePaths({
      typescript: import('https://esm.sh/typescript'),
    })

    const transform = await Promise.all([
      typescriptTransform({
        typescript: import('https://esm.sh/typescript'),
        tsconfig,
      }),
      babelTransform({
        babel: import('https://esm.sh/@babel/standalone'),
        presets: ['babel-preset-solid'],
      }),
    ])

    const runtime = new Runtime({
      importExternalTypes: true,
      transformModulePaths,
      transform,
      files: {
        'src/index.module.css': `body {
    background: blue;
    }
    /* .test */
    .button {
      background: red;
    }
    `,
        'src/index.tsx': `import { render } from "solid-js/web";
import { dispose } from "@repl/std";
import "solid-js/jsx-runtime";
import styles from "./index.module.css";

function App() {
  return (
    <button class={styles.button} >
      hello
    </button>
  );
}

dispose('src/index.tsx', render(() => <App />, document.body));
`,
      },
      extensions: {
        'module.css': CssModuleFile,
      },
    })
    runtime.initialize()

    // set global runtime
    setRuntime(runtime)
    // set global monaco
    setMonaco({ tsconfig, theme: vs_dark as any, monaco: loader.init() })

    const frameRegistry = runtime.frameRegistry
    const fileSystem = runtime.fileSystem

    createEffect(() => {
      const frame = frameRegistry.get('default')

      if (!frame) return

      const entry = fileSystem.get('src/index.tsx')

      createEffect(() => {
        if (!entry) return
        // inject entry's module-url into frame's window
        frame.injectFile(entry)
        // Dispose
        createEffect(
          on(
            () => entry.url,
            () => onCleanup(() => frame.dispose(entry.path)),
          ),
        )
      })

      if (entry instanceof JsFile) {
        entry.onDependencyRemoved(file => frame.dispose(file.path))
      }
    })
  })

  return (
    <div
      style={{
        display: 'flex',
        'flex-direction': 'row',
        height: '100%',
      }}
    >
      <repl-frame style={{ flex: '1' }} />
      <div style={{ overflow: 'visible', flex: 1, display: 'flex', 'flex-direction': 'column' }}>
        <repl-shiki-editor
          path="src/index.tsx"
          style={{
            '--padding': '10px',
            '--height': '100%',
            '--width': '100%',
            flex: 1,
            overflow: 'auto',
          }}
        />
        <repl-monaco-editor path="src/index.tsx" style={{ flex: '1' }} />
      </div>
    </div>
  )
}

export default App
