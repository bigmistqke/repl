import { defaultFileUrlSystem } from '@bigmistqke/repl'
import { createFileSystem } from '@bigmistqke/solid-fs-components'
import { createSignal } from 'solid-js'
import ts from 'typescript'
import './index.css'

const fs = createFileSystem()
const fileUrls = defaultFileUrlSystem({
  ts,
  readFile: fs.readFile,
})

export const App = () => {
  const [selectedPath, setSelectedPath] = createSignal<string>('index.html')

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
        oninput={e => {
          fs.writeFile(selectedPath(), e.target.value)
        }}
        value={fs.readFile(selectedPath())}
      ></textarea>
      <iframe src={fileUrls.get('index.html')}></iframe>
    </>
  )
}
