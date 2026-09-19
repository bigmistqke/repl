import { defaultExtensions, defaultFileUrlSystem, Repl, ReplElement } from '@bigmistqke/repl'
import { createEffect, createSignal, latest } from 'solid-js'
import ts from 'typescript'
import { createFileSystem } from './create-file-system.ts'
import './index.css'

if (!customElements.get('repl-element')) {
  customElements.define('repl-element', ReplElement)
}

const FILE_PATHS = ['index.html', 'index.css', 'main.ts', 'maths.ts']

const fs = createFileSystem()
const fileUrls = defaultFileUrlSystem({
  ts,
  readFile: fs.readFile,
})
const extensions = defaultExtensions({
  ts,
  readFile: fs.readFile,
})

fs.writeFile('index.css', `body { font-size: 32pt; }`)
fs.writeFile('maths.ts', 'export function sum(a: number, b: number){ return a + b }')

fs.writeFile(
  'main.ts',
  `import {sum} from "./maths.ts"

function randomValue(){
  return sum(200, Math.random() * 50)
}

function randomColor(){
  document.body.style.background = \`rgb(\${randomValue()}, \${randomValue()}, \${randomValue()})\`
}

requestAnimationFrame(randomColor)
setInterval(randomColor, 2000)`,
)

fs.writeFile(
  'index.html',
  `<head>
  <script src="./main.ts" type="module"></script>
<link rel="stylesheet" href="./index.css"></link>
</head>
<body>
hallo world 👋
</body>`,
)

/** `<Repl/>` reads files reactively through `fs.readFile` directly. */
function ReplDemo() {
  return (
    <Repl
      readFile={fs.readFile}
      entry="index.html"
      extensions={extensions}
      style={{ width: '100%', height: '300px', display: 'block' }}
      ref={({ fileUrls, element }) => console.log('<Repl/> mounted', { fileUrls, element })}
    />
  )
}

/**
 * `<repl-element>` takes a `files` snapshot rather than a `readFile`
 * function, so it's re-set whenever any tracked file changes.
 */
function ReplElementDemo() {
  const element = document.createElement('repl-element') as ReplElement
  element.style.cssText = 'width:100%;height:300px;display:block;'
  element.extensions = extensions
  element.ref = ({ fileUrls, element }) =>
    console.log('<repl-element> mounted', { fileUrls, element })

  createEffect(
    () => {
      const files: Record<string, string> = {}
      for (const path of FILE_PATHS) {
        files[path] = fs.readFile(path) ?? ''
      }
      return files
    },
    files => {
      element.files = { files, entry: 'index.html' }
    },
  )

  return element
}

export const App = () => {
  const [selectedPath, setSelectedPath] = createSignal<string>('index.html')

  const Button = (props: { path: string }) => (
    <button onclick={() => setSelectedPath(props.path)}>{props.path}</button>
  )

  return (
    <>
      <div class="buttons">
        <Button path="index.html" />
        <Button path="index.css" />
        <Button path="main.ts" />
        <Button path="maths.ts" />
      </div>
      <textarea
        style={{ 'min-height': '200px' }}
        oninput={e => {
          fs.writeFile(selectedPath(), e.target.value)
        }}
        value={fs.readFile(selectedPath())}
      ></textarea>
      <iframe src={latest(() => fileUrls.get('index.html'))}></iframe>

      <h2>{'<Repl/>'}</h2>
      <ReplDemo />

      <h2>{'<repl-element>'}</h2>
      <ReplElementDemo />
    </>
  )
}
