import type { Component } from 'solid-js'
import { Editor, MonacoProvider } from '../src'

const App: Component = () => {
  return (
    <>
      <MonacoProvider>
        <Editor name="default" />
      </MonacoProvider>
    </>
  )
}

export default App
