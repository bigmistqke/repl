import { DevTools, Frame, Repl, TabBar, useRuntime } from '@bigmistqke/repl'
import { MonacoEditor, MonacoProvider, MonacoTheme } from '@bigmistqke/repl/editor/monaco'
import { JsFile, VirtualFile, WasmFile } from '@bigmistqke/repl/runtime'
import { typescriptTransformModulePaths } from '@bigmistqke/repl/transform-module-paths/typescript'
import { babelTransform } from '@bigmistqke/repl/transform/babel'
import loader from '@monaco-editor/loader'
import { Resizable } from 'corvu/resizable'
import {
  Resource,
  createEffect,
  createResource,
  createSignal,
  mapArray,
  onCleanup,
  type Component,
} from 'solid-js'
import vs_dark from 'src/editor/monaco/themes/vs_dark_good.json'
import { babelSolidReplPlugin } from 'src/plugins/babel-solid-repl'
import { every, whenever } from 'src/utils/conditionals'
import WABT from 'wabt'
import styles from './App.module.css'

const tsconfig = {
  target: /* ScriptTarget.ES2015  */ 2, // Output ES6 compatible code
  module: /* ModuleKind.ES2015 */ 5, // Use ES6 modules
  jsx: /* JsxEmit.Preserve */ 1, // Preserve JSX syntax for further processing with Babel
  jsxImportSource: 'solid-js', // Use solid-js for JSX
  esModuleInterop: true, // Enables emit interoperability between CommonJS and ES Modules
  allowSyntheticDefaultImports: true, // Allow default imports from modules with no default export
  forceConsistentCasingInFileNames: true, // Ensure consistent casing in file names
  isolatedModules: true, // Ensure each file is treated as a separate module
  resolveJsonModule: true, // Include JSON modules in TypeScript files
  skipLibCheck: true, // Skip type checking of declaration files
  strict: true, // Enable all strict type-checking options
  noEmit: false, // Allow TypeScript to emit output files
  outDir: './dist', // Specify output directory for compiled files
}

let cachedWabt: Resource<Awaited<ReturnType<typeof WABT>>>
function getWabtResource() {
  if (!cachedWabt) {
    ;[cachedWabt] = createResource(() => WABT())
  }
  return cachedWabt
}

class WatFile extends VirtualFile {
  private wasmFile: WasmFile

  constructor(path: string) {
    super(path)
    this.wasmFile = new WasmFile(path.replace('.wat', '.wasm'))
    const wabt = getWabtResource()
    const [wasm] = createResource(every(this.get.bind(this), wabt), ([source, wabt]) =>
      wabt.parseWat(path, source),
    )

    createEffect(
      whenever(wasm, wasm => {
        const { buffer } = wasm.toBinary({})
        const base64String = btoa(String.fromCharCode(...new Uint8Array(buffer)))
        this.wasmFile.set(base64String)
      }),
    )
  }

  generate() {
    return this.wasmFile.generate()
  }

  get url() {
    return this.wasmFile.url // Use the URL from WasmFile
  }
}

const Frames = () => {
  const [isDragging, setIsDragging] = createSignal(false)
  return (
    <Resizable.Panel
      as={Resizable}
      style={{ display: 'flex', overflow: 'hidden', flex: 1 }}
      orientation="vertical"
    >
      <Resizable.Panel
        as={Frame}
        style={{
          'min-height': 0,
          'pointer-events': isDragging() ? 'none' : undefined,
          display: 'flex',
          overflow: 'none',
        }}
        bodyStyle={{
          padding: '0px',
          margin: '0px',
        }}
      />
      <Resizable.Handle
        onDragStart={() => setIsDragging(true)}
        onDragEnd={() => setIsDragging(false)}
        class={styles.handle}
      />
      <Resizable.Panel
        as={DevTools}
        minSize={0}
        name={'default'}
        style={{
          'min-height': 0,
          'pointer-events': isDragging() ? 'none' : undefined,
          overflow: 'hidden',
        }}
      />
    </Resizable.Panel>
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

  return (
    <Repl
      debug
      importExternalTypes
      transformModulePaths={typescriptTransformModulePaths({
        typescript: import('https://esm.sh/typescript'),
      })}
      transform={babelTransform({
        babel: import('https://esm.sh/@babel/standalone'),
        presets: ['babel-preset-solid'],
        plugins: [babelSolidReplPlugin],
      })}
      extensions={{
        wat: (runtime, path) => new WatFile(path),
      }}
      initialState={{
        files: {
          sources: {
            'src/index.css': `body {
  background: blue;
}`,
            'src/index.tsx': `import { render } from "solid-js/web";
import { createSignal, createResource, createEffect, Show } from "solid-js";
import "solid-js/jsx-runtime";
import "./index.css";
import wat from "./test.wat";

function App() {
  const [wasm] = createResource(async () => {
    let memory;
    const wasm = await wat({
        env: {
        jsprint: function jsprint(byteOffset) {
          var s = '';
          var a = new Uint8Array(memory.buffer);
          for (var i = byteOffset; a[i]; i++) {
            s += String.fromCharCode(a[i]);
          }
          alert(s);
        }
      }
    })
    memory = wasm.exports.pagememory;
    return wasm
  })

  return (
    <button onClick={() => wasm()?.exports.helloworld()}>
      hello world from wasm
    </button>
  );
}

render(() => <App />, document.body);
`,
            'src/test.wat': `
          ;; hello_world.wat

(module

  ;; Import our myprint function 
  (import "env" "jsprint" (func $jsprint (param i32)))

  ;; Define a single page memory of 64KB.
  (memory $0 1)

  ;; Store the Hello World (null terminated) string at byte offset 0 
  (data (i32.const 0) "Hello World!\x00")

  ;; Export the memory so it can be access in the host environment.
  (export "pagememory" (memory $0))

  ;; Define a function to be called from our host
  (func $helloworld
    (call $jsprint (i32.const 0))
  )

  ;; Export the wasmprint function for the host to call.
  (export "helloworld" (func $helloworld))
)
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

          createEffect(() => console.log('THIS HAPPENS', entry?.generate()))

          if (entry instanceof JsFile) {
            createEffect(() => {
              // inject entry's module-url into frame's window
              frame.injectFile(entry)
              onCleanup(() => frame.dispose(entry))
            })

            createEffect(
              mapArray(entry.cssImports, css => {
                createEffect(() => frame.injectFile(css))
                onCleanup(() => frame.dispose(css))
              }),
            )
          }
        })
      }}
    >
      <Resizable style={{ width: '100vw', height: '100vh', display: 'flex' }}>
        <Resizable.Panel
          style={{ overflow: 'hidden', display: 'flex', 'flex-direction': 'column' }}
        >
          <div style={{ display: 'flex' }}>
            <TabBar style={{ flex: 1 }}>
              {({ path }) => <button onClick={() => setCurrentFile(path)}>{path}</button>}
            </TabBar>
            <AddButton />
          </div>
          <MonacoProvider monaco={loader.init()} theme={vs_dark as MonacoTheme} tsconfig={tsconfig}>
            <MonacoEditor style={{ flex: 1 }} path={currentPath()} />
          </MonacoProvider>
        </Resizable.Panel>
        <Resizable.Handle class={styles.handle} />
        <Frames />
      </Resizable>
    </Repl>
  )
}

export default App
