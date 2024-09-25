import { Runtime } from '@bigmistqke/repl'
import '@bigmistqke/repl/element'
import '@bigmistqke/repl/element/tm-editor'
import { CssModuleFile } from '@bigmistqke/repl/extensions/css-module'
import { typescriptTransformModulePaths } from '@bigmistqke/repl/transform-module-paths/typescript'
import { babelTransform } from '@bigmistqke/repl/transform/babel'
import { typescriptTransform } from '@bigmistqke/repl/transform/typescript'
import { createResource, Show, type Component } from 'solid-js'
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
          plugins: [['proposal-decorators', { version: '2023-11' }]],
          presets: ['babel-preset-solid@1.8.22'],
        }),
      ]),
    ])

    return new Runtime({
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
      <Show when={runtime()}>
        {runtime => (
          <>
            <repl-frame
              style={{ flex: '1' }}
              onReady={({ frame }) => {
                const file = runtime().getFile('src/index.tsx')!
                let cleanup: undefined | (() => void)
                function injectUrl({ url }: { url?: string }) {
                  cleanup?.()
                  if (!url) return
                  frame.clearBody()
                  cleanup = frame.injectModuleUrl(url)
                }
                file.addEventListener('url', injectUrl)
                injectUrl(file)
              }}
            />
            <tm-textarea
              value={runtime().getFile('src/index.tsx').source}
              onInput={e => runtime().setFile('src/index.tsx', e.currentTarget.value)}
              theme="andromeeda"
              style={{
                padding: '20px',
                overflow: 'auto',
                flex: '1',
              }}
            />
          </>
        )}
      </Show>
    </div>
  )
}

render(() => <App />, document.getElementById('root')!)
