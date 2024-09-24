import { Runtime } from '@bigmistqke/repl'
import '@bigmistqke/repl/element'
import '@bigmistqke/repl/element/tm-editor'
import { CssModuleFile } from '@bigmistqke/repl/extensions/css-module'
import { typescriptTransformModulePaths } from '@bigmistqke/repl/transform-module-paths/typescript'
import { babelTransform } from '@bigmistqke/repl/transform/babel'
import { typescriptTransform } from '@bigmistqke/repl/transform/typescript'
import { createEffect, createResource, type Component } from 'solid-js'
import { render } from 'solid-js/web'
import './styles.css'

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
  const [runtime] = createResource(async () => {
    const [transformModulePaths, transform] = await Promise.all([
      typescriptTransformModulePaths(),
      Promise.all([
        typescriptTransform({
          tsconfig,
        }),
        babelTransform({
          presets: ['babel-preset-solid'],
        }),
      ]),
    ])

    const runtime = new Runtime({
      importExternalTypes: false,
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

dispose('src/index.tsx', render(() => <App />, document.body));`,
      },
      extensions: {
        'module.css': CssModuleFile,
      },
    }).initialize()

    // set global monaco
    // setMonaco({ tsconfig, theme: vs_dark as any, monaco: loader.init() })

    createEffect(() => {
      const frame = runtime.frames.get('default')

      if (!frame) return

      const entry = runtime.fs.get('src/index.tsx')

      createEffect(() => {
        if (!entry) return
        // inject entry's module-url into frame's window
        frame.injectFile(entry)
      })
    })
    return runtime
  })

  return (
    <div
      style={{
        display: 'flex',
        'flex-direction': 'row',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <repl-runtime value={runtime()}>
        <repl-frame style={{ flex: '1' }} />
        <repl-tm-editor
          path="src/index.tsx"
          theme="andromeeda"
          style={{
            padding: '20px',
            overflow: 'auto',
            flex: '1',
          }}
        />
      </repl-runtime>
    </div>
  )
}

render(() => <App />, document.getElementById('root')!)
