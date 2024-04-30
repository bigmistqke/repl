import { Repl, useRepl } from '@bigmistqke/repl'
import { solidReplPlugin } from '@bigmistqke/repl/plugins/solid-repl'
import { Resizable } from 'corvu/resizable'
import { createEffect, createSignal, mapArray, on, onCleanup, type Component } from 'solid-js'
import { JsFile } from 'src/logic/file'

import styles from './App.module.css'
import config from './repl.config.json'

const App: Component = () => {
  const [currentPath, setCurrentFile] = createSignal('src/index.tsx')

  const AddButton = () => {
    const repl = useRepl()

    return (
      <button
        onClick={() => {
          let index = 1
          let path = `src/index.tsx`
          while (repl.fileSystem.has(path)) {
            path = `src/index${index}.tsx`
            index++
          }
          console.log('path is ', path, repl.fileSystem.has(path))
          repl.fileSystem.create(path)
          setCurrentFile(path)
        }}
      >
        add file
      </button>
    )
  }

  return (
    <Repl
      babel={{
        presets: ['babel-preset-solid'],
        plugins: [solidReplPlugin],
      }}
      typescript={{
        resolveJsonModule: true,
        esModuleInterop: true,
        noEmit: true,
        isolatedModules: true,
        skipLibCheck: true,
        allowSyntheticDefaultImports: true,
        forceConsistentCasingInFileNames: true,
        noUncheckedIndexedAccess: true,
        paths: {},
        jsx: /* JsxEmit.Preserve */ 1,
        jsxImportSource: 'solid-js',
        strict: true,
      }}
      initialState={{
        types: config.types,
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
  const increment = () => setCount(count => count + 1);

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
              onCleanup(() => entry.dispose(frame))
            })

            createEffect(
              mapArray(entry.cssImports, css => {
                createEffect(() => frame.injectFile(css))
                onCleanup(() => css.dispose(frame))
              }),
            )
          }
        })
        /* await fileSystem.addPackage('./solid-three') */
      }}
    >
      <Resizable style={{ width: '100vw', height: '100vh', display: 'flex' }}>
        <Resizable.Panel
          style={{ overflow: 'hidden', display: 'flex', 'flex-direction': 'column' }}
        >
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
              createEffect(on(currentPath, () => editor.focus()))
            }}
          />
        </Resizable.Panel>
        <Resizable.Handle />
        <Resizable.Panel style={{ display: 'flex', overflow: 'hidden' }}>
          <Repl.Frame
            style={{ flex: 1 }}
            bodyStyle={{
              padding: '0px',
              margin: '0px',
            }}
          />
        </Resizable.Panel>
      </Resizable>
    </Repl>
  )
}

export default App
