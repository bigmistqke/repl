import { Frame, Repl, TabBar } from '@bigmistqke/repl'
import { MonacoEditor, MonacoProvider, MonacoTheme } from '@bigmistqke/repl/editor/monaco'
import { CssModuleFile } from '@bigmistqke/repl/file-extra/css-module'
import { JsFile } from '@bigmistqke/repl/runtime'
import { typescriptTransformModulePaths } from '@bigmistqke/repl/transform-module-paths/typescript'
import { babelTransform } from '@bigmistqke/repl/transform/babel'
import { typescriptTransform } from '@bigmistqke/repl/transform/typescript'
import loader from '@monaco-editor/loader'
import { Resizable } from 'corvu/resizable'
import { createEffect, createSignal, on, onCleanup, type Component } from 'solid-js'
import { createStore } from 'solid-js/store'
import vs_dark from 'src/editor/monaco/themes/vs_dark_good.json'
import styles from './App.module.css'

const tsconfig = {
  target: /* ScriptTarget.ES2015  */ 2, // Output ES6 compatible code
  module: /* ModuleKind.ES2015 */ 5, // Use ES6 modules
  jsx: /* JsxEmit.Preserve */ 1, // Preserve JSX syntax for further processing with Babel
  jsxImportSource: 'solid-js', // Use solid-js for JSX
  esModuleInterop: true, // Enables emit interoperability between CommonJS and ES Modules
  allowSyntheticDefaultImports: true, // Allow default imports from modules with no default export
  forceConsistentCasingInFileNames: true, // Ensure consistent casing in file names
  isolatedModules: true, // Ensure each file is treated as a separate module
  resolveJsonModule: true, // Include JSON modules in TypeScript files
  skipLibCheck: true, // Skip type checking of declaration files
  strict: true, // Enable all strict type-checking options
  noEmit: false, // Allow TypeScript to emit output files
  outDir: './dist', // Specify output directory for compiled files
}

const App: Component = () => {
  const [currentPath, setCurrentFile] = createSignal('src/index.tsx')
  const [files, setFiles] = createStore<Record<string, string>>({
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
  })

  return (
    <Repl
      debug
      importExternalTypes
      controlled
      transformModulePaths={typescriptTransformModulePaths({
        typescript: import('https://esm.sh/typescript'),
      })}
      transform={[
        typescriptTransform({
          typescript: import('https://esm.sh/typescript'),
          tsconfig,
        }),
        babelTransform({
          babel: import('https://esm.sh/@babel/standalone'),
          presets: ['babel-preset-solid'],
        }),
      ]}
      extensions={{
        'module.css': CssModuleFile,
      }}
      files={files}
      class={styles.repl}
      onFileChange={(path, source) => setFiles(path, source)}
      onSetup={async ({ fileSystem, frameRegistry }) => {
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
      }}
    >
      <Resizable style={{ width: '100vw', height: '100vh', display: 'flex' }}>
        <Resizable.Panel
          style={{ overflow: 'hidden', display: 'flex', 'flex-direction': 'column' }}
        >
          <TabBar>
            {({ path }) => <button onClick={() => setCurrentFile(path)}>{path}</button>}
          </TabBar>
          <MonacoProvider monaco={loader.init()} theme={vs_dark as MonacoTheme} tsconfig={tsconfig}>
            <MonacoEditor style={{ flex: 1 }} path={currentPath()} />
          </MonacoProvider>
        </Resizable.Panel>
        <Resizable.Handle class={styles.handle} />
        {(() => {
          const [isDragging, setIsDragging] = createSignal(false)
          return (
            <Resizable.Panel
              as={Resizable}
              style={{ display: 'flex', overflow: 'hidden', flex: 1 }}
              orientation="vertical"
            >
              <Frame
                style={{
                  'min-height': 0,
                  'pointer-events': isDragging() ? 'none' : undefined,
                  display: 'flex',
                  height: '100%',
                  overflow: 'none',
                }}
                bodyStyle={{
                  padding: '0px',
                  margin: '0px',
                }}
              />
            </Resizable.Panel>
          )
        })()}
      </Resizable>
    </Repl>
  )
}

export default App
