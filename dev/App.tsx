import { Repl } from '@bigmistqke/repl'
import { solidReplPlugin } from '@bigmistqke/repl/plugins/solid-repl'

import { createEffect, createSignal, onCleanup, type Component } from 'solid-js'
import { JsxEmit } from 'typescript'
import cached from './repl.config.json'

import styles from './App.module.css'

const App: Component = () => {
  const [currentFile, setCurrentFile] = createSignal('src/index.tsx')
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
        jsx: JsxEmit.Preserve,
        jsxImportSource: 'solid-js',
        strict: true,
      }}
      initialState={{
        types: cached.types,
        files: {
          'src/sum.tsx': 'export const sum = (a,b) => a + b',
          'src/index.tsx': `
import { render } from "solid-js/web";
import { createSignal } from "solid-js";
import { sum } from "./sum";

console.log(sum)

function Counter() {
  const [count, setCount] = createSignal(1);
  const increment = () => setCount(count => count + 1);

  return (
    <button type="button" onClick={increment}>
      {sum(count(), count())}
    </button>
  );
}

render(() => <Counter />, document.body);
`,
        },
      }}
      class={styles.repl}
      onReady={({ fs, frames }) => {
        createEffect(() => {
          const frame = frames.get('default')
          const moduleUrl = fs.get('src/index.tsx')?.moduleUrl()

          if (!frame || !moduleUrl) return

          onCleanup(() => {
            frame.document.body.removeChild(script)
            frame.window.dispose?.()
          })

          const script = frame.document.createElement('script')
          script.type = 'module'
          script.src = moduleUrl
          frame.document.body.appendChild(script)
        })
      }}
    >
      <Repl.Panel column>
        <Repl.TabBar>
          {({ path }) => <Repl.TabBar.Tab onClick={() => setCurrentFile(path)} />}
        </Repl.TabBar>
        <Repl.Editor path={currentFile()} />
      </Repl.Panel>
      <Repl.Frame bodyStyle={{ padding: '0px', margin: '0px' }} />
    </Repl>
  )
}

export default App
