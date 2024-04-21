import { Repl } from '@bigmistqke/repl'
import { solidReplPlugin } from '@bigmistqke/repl/plugins/solid-repl'

import { createEffect, onCleanup, type Component } from 'solid-js'
import { JsxEmit } from 'typescript'
import cached from './repl.config.json'

import { when } from '@bigmistqke/when'
import styles from './App.module.css'

const App: Component = () => {
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
      initialState={{ types: cached.types }}
      class={styles.repl}
      onCompilation={({ url, fileSystem: { frame }, path }) => {
        if (path !== 'src/default.tsx') return
        createEffect(() =>
          when(frame)(frame => {
            const script = frame.document.createElement('script')
            script.type = 'module'
            script.src = url
            frame.document.body.appendChild(script)
            onCleanup(() => {
              frame.document.body.removeChild(script)
              frame.window.dispose?.()
            })
          }),
        )
      }}
    >
      <Repl.Editor
        name="src/default.tsx"
        initialValue={
          /* tsx */ `
import { render } from "solid-js/web";
import { createSignal } from "solid-js";

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
`
        }
      />
      <Repl.Frame />
    </Repl>
  )
}

export default App
