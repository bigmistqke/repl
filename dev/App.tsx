import { DevTools, Frame, Repl, TabBar, useRuntime } from '@bigmistqke/repl'
import { MonacoEditor, MonacoProvider, MonacoTheme } from '@bigmistqke/repl/editor/monaco'
import vs_dark from '@bigmistqke/repl/editor/monaco/themes/vs_dark_good.json'
import { JsFile, Runtime } from '@bigmistqke/repl/runtime'
import { typescriptTransformModulePaths } from '@bigmistqke/repl/transform-module-paths/typescript'
import { babelTransform } from '@bigmistqke/repl/transform/babel'
import { createEffect, createSignal, mapArray, onCleanup, type Component } from 'solid-js'
import { babelSolidReplPlugin } from 'src/plugins/babel-solid-repl'

const tsconfig = {
  target: 2, // ScriptTarget.ES2015
  module: 5, // ModuleKind.ES2015
  jsx: 1, // JsxEmit.Preserve
  jsxImportSource: 'solid-js',
  esModuleInterop: true,
  allowSyntheticDefaultImports: true,
  forceConsistentCasingInFileNames: true,
  isolatedModules: true,
  resolveJsonModule: true,
  skipLibCheck: true,
  strict: true,
  noEmit: false,
}

const Frames = () => {
  return (
    <>
      <Frame
        bodyStyle={{
          padding: '0px',
          margin: '0px',
        }}
      />
      <DevTools name={'default'} />
    </>
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

  function onSetup({ fileSystem, frameRegistry }: Runtime) {
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
  }

  return (
    <Repl
      debug
      importExternalTypes
      transformModulePaths={typescriptTransformModulePaths(import('https://esm.sh/typescript'))}
      transform={babelTransform({
        babel: import('https://esm.sh/@babel/standalone'),
        presets: ['babel-preset-solid'],
        plugins: [babelSolidReplPlugin],
      })}
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
      onSetup={onSetup}
    >
      <div>
        <TabBar>
          {({ path }) => <button onClick={() => setCurrentFile(path)}>{path}</button>}
        </TabBar>
        <AddButton />
      </div>
      <MonacoProvider theme={vs_dark as MonacoTheme} tsconfig={tsconfig}>
        <MonacoEditor path={currentPath()} />
      </MonacoProvider>
      <Frames />
    </Repl>
  )
}

export default App
