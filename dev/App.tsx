import { DevTools, Frame, JsFile, MonacoEditor, Repl, TabBar, useRuntime } from '@bigmistqke/repl'
import { solidReplPlugin } from '@bigmistqke/repl/plugins'
import { Resizable } from 'corvu/resizable'
import { createEffect, createSignal, mapArray, onCleanup, type Component } from 'solid-js'
import styles from './App.module.css'

const Frames = () => {
  const [isDragging, setIsDragging] = createSignal(false)
  return (
    <Resizable.Panel
      as={Resizable}
      style={{ display: 'flex', overflow: 'hidden', flex: 1 }}
      orientation="vertical"
    >
      <Resizable.Panel
        as={Frame}
        style={{
          'min-height': 0,
          'pointer-events': isDragging() ? 'none' : undefined,
          display: 'flex',
          overflow: 'none',
        }}
        bodyStyle={{
          padding: '0px',
          margin: '0px',
        }}
      />
      <Resizable.Handle
        onDragStart={() => setIsDragging(true)}
        onDragEnd={() => setIsDragging(false)}
        class={styles.handle}
      />
      <Resizable.Panel
        as={DevTools}
        minSize={0}
        name={'default'}
        style={{
          'min-height': 0,
          'pointer-events': isDragging() ? 'none' : undefined,
          overflow: 'hidden',
        }}
      />
    </Resizable.Panel>
  )
}

const App: Component = () => {
  const [currentPath, setCurrentFile] = createSignal('src/index.tsx')

  const AddButton = () => {
    const runtime = useRuntime()

    return (
      <button
        onClick={() => {
          let index = 1
          let path = `src/index.tsx`
          while (runtime.fileSystem.has(path)) {
            path = `src/index${index}.tsx`
            index++
          }
          runtime.fileSystem.create(path)
          setCurrentFile(path)
        }}
      >
        add file
      </button>
    )
  }

  return (
    <Repl
      debug
      importExternalTypes
      babel={{
        library: import('https://esm.sh/@babel/standalone' as string),
        presets: ['babel-preset-solid'],
        plugins: [solidReplPlugin],
      }}
      typescript={{
        library: import('https://esm.sh/typescript' as string),
        compilerOptions: {
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
        },
      }}
      initialState={{
        files: {
          sources: {
            'src/index.css': `body {
  background: blue;
}`,
            'src/index.tsx': `import { render } from "solid-js/web";
import { createSignal } from "solid-js";
import "solid-js/jsx-runtime";
import "./index.css";

function Counter() {
  const [count, setCount] = createSignal(1);
  const increment = () => {
    console.log('increment');
    setCount(count => count + 1);
  }

  return (
    <button type="button" onClick={increment}>
      {count()}
    </button>
  );
}

render(() => <Counter />, document.body);
`,
          },
        },
      }}
      class={styles.repl}
      onSetup={async ({ fileSystem, frameRegistry }) => {
        createEffect(() => {
          const frame = frameRegistry.get('default')
          if (!frame) return

          const entry = fileSystem.get('src/index.tsx')

          if (entry instanceof JsFile) {
            createEffect(() => {
              // inject entry's module-url into frame's window
              frame.injectFile(entry)
              onCleanup(() => frame.dispose(entry))
            })

            createEffect(
              mapArray(entry.module.cssImports, css => {
                createEffect(() => frame.injectFile(css))
                onCleanup(() => frame.dispose(css))
              }),
            )
          }
        })
      }}
    >
      <Resizable style={{ width: '100vw', height: '100vh', display: 'flex' }}>
        <Resizable.Panel
          style={{ overflow: 'hidden', display: 'flex', 'flex-direction': 'column' }}
        >
          <div style={{ display: 'flex' }}>
            <TabBar style={{ flex: 1 }}>
              {({ path }) => <button onClick={() => setCurrentFile(path)}>{path}</button>}
            </TabBar>
            <AddButton />
          </div>
          {/* <ShikiEditor
            theme={darkPlus}
            lang={tsx}
            style={{ flex: 1, padding: '20px' }}
            path={currentPath()}
          /> */}
          <MonacoEditor editor={{}} style={{ flex: 1 }} path={currentPath()} />
        </Resizable.Panel>
        <Resizable.Handle class={styles.handle} />
        <Frames />
      </Resizable>
    </Repl>
  )
}

export default App
