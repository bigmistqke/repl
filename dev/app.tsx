import { defaultFileUrlSystem } from '@bigmistqke/repl'
import { createFileSystem } from '@bigmistqke/solid-fs-components'
import { createEffect, createSignal } from 'solid-js'
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
  fs.writeFile('index2.html', 'hallo')

  console.log(fileUrls.get('index2.html'))

  setTimeout(() => {
    fs.rm('index2.html')

    createEffect(() => console.log("fileUrls.get('index2.html')", fileUrls.get('index2.html')))

    setTimeout(() => {
      console.log('write file')
      fs.writeFile('index2.html', 'haloooo')
    }, 1_000)
  }, 1_000)

  fs.writeFile(
    'main.ts',
    `function randomValue(){
  return 200 + Math.random() * 50
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
  <script src="./main.ts"></script>
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
