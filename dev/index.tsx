import { Runtime } from '@bigmistqke/repl'
import '@bigmistqke/repl/element'
import '@bigmistqke/repl/element/monaco-editor'
import { typescriptTransformModulePaths } from '@bigmistqke/repl/transform-module-paths/typescript'
import { babelTransform } from '@bigmistqke/repl/transform/babel'
import { typescriptTransform } from '@bigmistqke/repl/transform/typescript'
import loader from '@monaco-editor/loader'
import {
  compressToEncodedURIComponent as compress,
  decompressFromEncodedURIComponent as decompress,
} from 'lz-string'
import { createResource, Show, type Component } from 'solid-js'
import { render } from 'solid-js/web'
import vs_dark from 'src/element/editor/themes/vs_dark_good.json'
import { register } from 'tm-textarea'
import './styles.css'

register()

const files = location.hash
  ? JSON.parse(decompress(location.hash.slice(1)))
  : {
      'src/index.css': `body {
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
import "./index.css";

function App() {
return (
  <button class="button" >
    hello
  </button>
);
}

dispose('src/index.tsx', render(() => <App />, document.body));`,
    }

const App: Component = () => {
  const [runtime] = createResource(async () => {
    const [transformModulePaths, transform] = await Promise.all([
      typescriptTransformModulePaths(),
      Promise.all([
        typescriptTransform(),
        babelTransform({
          plugins: [['proposal-decorators', { version: '2023-11' }]],
          presets: ['babel-preset-solid@1.8.22'],
        }),
      ]),
    ])

    return new Runtime({
      importExternalTypes: true,
      transformModulePaths,
      tsconfig: {
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
      },
      transform,
      files,
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
            <repl-monaco-editor
              runtime={runtime()}
              path="src/index.tsx"
              monaco={loader.init()}
              theme={vs_dark as any}
              style={{
                flex: '1',
              }}
            />
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
                file.onUrl(injectUrl)
                file.onSource(() => {
                  location.hash = compress(JSON.stringify(runtime().fs.toJSON().sources))
                })
                injectUrl(file)
              }}
            />
          </>
        )}
      </Show>
    </div>
  )
}

render(() => <App />, document.getElementById('root')!)
