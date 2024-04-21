import { type Component } from 'solid-js'
import { Editor, MonacoProvider } from '../src'

const App: Component = () => {
  return (
    <>
      <MonacoProvider babel={{ presets: ['babel-preset-solid'] }}>
        <Editor
          name="default.tsx"
          initialValue={`import {createSignal, createEffect} from "solid-js"
const [signal, setSignal] = createSignal(0);
createEffect(() => console.log(signal()))
setTimeout(() => {
  setSignal(1)
}, 1000);
const div = <div/>;
`}
        />
      </MonacoProvider>
    </>
  )
}

export default App
