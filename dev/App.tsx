import { type Component } from 'solid-js'
import { JsxEmit } from 'typescript'
import { Editor, MonacoProvider } from '../src'
import cached from './repl.config.json'

const App: Component = () => {
  return (
    <>
      <MonacoProvider
        babel={{ presets: ['babel-preset-solid'] }}
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
      >
        <Editor
          name="src/default.tsx"
          initialValue={`import {createSignal, createEffect, } from "solid-js"

const [signal, setSignal] = createSignal(0);
createEffect(() => console.log(signal()))
setTimeout(() => {
  setSignal(1)
}, 1000);
const div = <div style={{ top: '0px'}}>hallo</div>;
`}
        />
      </MonacoProvider>
    </>
  )
}

export default App
