import { Frame, Repl, TabBar } from '@bigmistqke/repl'
import { JsFile, Runtime, VirtualFile, WasmFile } from '@bigmistqke/repl/runtime'
import { typescriptTransformModulePaths } from '@bigmistqke/repl/transform-module-paths/typescript'
import { babelTransform } from '@bigmistqke/repl/transform/babel'
import { typescriptTransform } from '@bigmistqke/repl/transform/typescript'
import loader from '@monaco-editor/loader'
import { Resizable } from 'corvu/resizable'
import {
  Resource,
  createEffect,
  createResource,
  createSignal,
  mapArray,
  on,
  onCleanup,
  type Component,
} from 'solid-js'
import { createStore } from 'solid-js/store'
import { MonacoEditor, MonacoProvider, MonacoTheme } from 'src/solid/editor/monaco'
import vs_dark from 'src/solid/editor/monaco/themes/vs_dark_good.json'
import { every, whenever } from 'src/utils/conditionals'
import WABT from 'wabt'
import zeptoid from 'zeptoid'
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

  constructor(runtime: Runtime, path: string) {
    super(runtime, path)

    this.wasmFile = new WasmFile(runtime, path.replace('.wat', '.wasm'), false)
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

function transformCssClasses(source: string, callback: (className: string) => string): string {
  const classPattern = /\.([a-zA-Z_][\w-]*)\b/g
  const classRanges: Record<string, [number, number][]> = {}

  // Helper function to strip strings and comments for class detection
  const stripStringsAndComments = (css: string): string => {
    // Remove CSS comments
    css = css.replace(/\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g, match => ' '.repeat(match.length))
    // Remove single and double-quoted strings
    css = css.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, match => ' '.repeat(match.length))
    return css
  }

  // Step 1: Collect all classes and their ranges
  const cleanCss = stripStringsAndComments(source)
  let match: RegExpExecArray | null
  while ((match = classPattern.exec(cleanCss)) !== null) {
    const className = match[1]!
    if (!classRanges[className]) {
      classRanges[className] = []
    }
    classRanges[className]!.push([match.index + 1, match.index + 1 + className.length])
  }

  // Step 2: Replace old class names with new class names using the ranges
  const replaceClasses = (
    css: string,
    ranges: Record<string, [number, number][]>,
    callback: (className: string) => string,
  ): string => {
    const newCssParts = []
    let lastIndex = 0

    for (const className in ranges) {
      const newClassName = callback(className)
      for (const [start, end] of ranges[className]!) {
        newCssParts.push(css.slice(lastIndex, start))
        newCssParts.push(newClassName)
        lastIndex = end
      }
    }
    newCssParts.push(css.slice(lastIndex))

    return newCssParts.join('')
  }

  // Transform the original source CSS
  const transformedCss = replaceClasses(source, classRanges, callback)

  return transformedCss
}

class CssModuleFile extends VirtualFile {
  jsFile: JsFile
  constructor(runtime: Runtime, path: string) {
    super(runtime, path)
    this.jsFile = runtime.fileSystem.create(`${path}.ts`)

    createEffect(() => {
      const aliases = {} as Record<string, string>
      const transformed = transformCssClasses(this.get(), className => {
        const newClassName = `${className}___REPL___${zeptoid()}`
        aliases[className] = newClassName
        return newClassName
      })
      this.jsFile.set(`
import { dispose } from "@repl/std"

declare module '${path}' {
  const styles: {
${Object.values(aliases)
  .map(alias => `    "${alias}": string;`)
  .join('\n')}
  };
}


(() => {
  let stylesheet = document.getElementById('bigmistqke-repl-${path}');
  stylesheet = document.createElement('style')
  stylesheet.setAttribute('id', 'bigmistqke-repl-${path}');
  document.head.appendChild(stylesheet)
  dispose('${path}', () => stylesheet.remove())
  const styles = document.createTextNode(\`${transformed}\`)
  stylesheet.innerHTML = ''
  stylesheet.appendChild(styles)
})()

export default ${JSON.stringify(aliases)}
        `)
    })
  }

  generate(): string | undefined {
    return this.jsFile.generate()
  }

  get url() {
    return this.jsFile.url
  }

  moduleTransform() {
    if (!this.url) throw `Module not loaded`
    return this.url
  }
}

const App: Component = () => {
  const [currentPath, setCurrentFile] = createSignal('src/index.tsx')
  const [files, setFiles] = createStore<Record<string, string>>({
    'src/index.module.css': `body {
background: blue;
}
/* .test */
.button {
  background: red;
}
`,
    'src/index.tsx': `import { render } from "solid-js/web";
import { createSignal, createResource, createEffect, Show } from "solid-js";
import { dispose } from "@repl/std";
import "solid-js/jsx-runtime";
import styles from "./index.module.css";
import wat from "./test.wat";

function App() {
  const [wasm] = createResource(async () => {
  let memory;
  const wasm = await wat({
    env: {
      jsprint: 
        function jsprint(byteOffset) {
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
    <button class={styles.button} onClick={() => wasm()?.exports.helloworld()}>
      hello world from wasm
    </button>
  );
}

dispose('src/index.tsx', render(() => <App />, document.body));
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
  })

  return (
    <Repl
      debug
      importExternalTypes
      controlled
      transformModulePaths={typescriptTransformModulePaths({
        typescript: import('https://esm.sh/typescript'),
      })}
      transform={[
        typescriptTransform({
          typescript: import('https://esm.sh/typescript'),
          tsconfig,
        }),
        babelTransform({
          babel: import('https://esm.sh/@babel/standalone'),
          presets: ['babel-preset-solid'],
        }),
      ]}
      extensions={{
        wat: (runtime, path) => new WatFile(runtime, path),
        'module.css': (runtime, path) => new CssModuleFile(runtime, path),
      }}
      files={files}
      class={styles.repl}
      onFileChange={(path, source) => setFiles(path, source)}
      onSetup={async ({ fileSystem, frameRegistry }) => {
        createEffect(() => {
          const frame = frameRegistry.get('default')
          if (!frame) return

          const entry = fileSystem.get('src/index.tsx')

          createEffect(() => {
            if (!entry) return
            // inject entry's module-url into frame's window
            frame.injectFile(entry)
            // Dispose
            createEffect(
              on(
                () => entry.url,
                () => onCleanup(() => frame.dispose(entry.path)),
              ),
            )

            if (entry instanceof JsFile) {
              createEffect(
                mapArray(
                  () => entry.resolveDependencies(),
                  dependency => {
                    createEffect(
                      on(
                        () => dependency.url,
                        () => onCleanup(() => frame.dispose(dependency.path)),
                      ),
                    )
                  },
                ),
              )
            }
          })
        })
      }}
    >
      <Resizable style={{ width: '100vw', height: '100vh', display: 'flex' }}>
        <Resizable.Panel
          style={{ overflow: 'hidden', display: 'flex', 'flex-direction': 'column' }}
        >
          <TabBar>
            {({ path }) => <button onClick={() => setCurrentFile(path)}>{path}</button>}
          </TabBar>
          <MonacoProvider monaco={loader.init()} theme={vs_dark as MonacoTheme} tsconfig={tsconfig}>
            <MonacoEditor style={{ flex: 1 }} path={currentPath()} />
          </MonacoProvider>
        </Resizable.Panel>
        <Resizable.Handle class={styles.handle} />
        {(() => {
          const [isDragging, setIsDragging] = createSignal(false)
          return (
            <Resizable.Panel
              as={Resizable}
              style={{ display: 'flex', overflow: 'hidden', flex: 1 }}
              orientation="vertical"
            >
              <Frame
                style={{
                  'min-height': 0,
                  'pointer-events': isDragging() ? 'none' : undefined,
                  display: 'flex',
                  height: '100%',
                  overflow: 'none',
                }}
                bodyStyle={{
                  padding: '0px',
                  margin: '0px',
                }}
              />
            </Resizable.Panel>
          )
        })()}
      </Resizable>
    </Repl>
  )
}

export default App
