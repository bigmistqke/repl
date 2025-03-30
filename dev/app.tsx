import {
  createFileSystem,
  isUrl,
  parseHtml,
  resolvePath,
  Transform,
  transformModulePaths,
} from '@bigmistqke/repl'
import { createSignal } from 'solid-js'
import ts from 'typescript'
import './index.css'

function createRepl() {
  const transformJs: Transform = ({ path, source, executables }) => {
    return transformModulePaths(source, modulePath => {
      if (modulePath.startsWith('.')) {
        // Swap relative module-path out with their respective module-url
        const url = executables.get(resolvePath(path, modulePath))
        if (!url) throw 'url is undefined'
        return url
      } else if (isUrl(modulePath)) {
        // Return url directly
        return modulePath
      } else {
        // Wrap external modules with esm.sh
        return `https://esm.sh/${modulePath}`
      }
    })!
  }

  return createFileSystem({
    css: { type: 'css' },
    js: {
      type: 'javascript',
      transform: transformJs,
    },
    ts: {
      type: 'javascript',
      transform({ path, source, fs }) {
        return transformJs({ path, source: ts.transpile(source), fs })
      },
    },
    html: {
      type: 'html',
      transform(config) {
        return (
          parseHtml(config)
            // Transform content of all `<script type="module" />` elements
            .transformModuleScriptContent(transformJs)
            // Bind relative `src`-attribute of all `<script />` elements
            .bindScriptSrc()
            // Bind relative `href`-attribute of all `<link />` elements
            .bindLinkHref()
            .toString()
        )
      },
    },
  })
}

export const App = () => {
  const [selectedPath, setSelectedPath] = createSignal<string>('index.html')

  const repl = createRepl()

  repl.writeFile(
    'index.html',
    `<head>
  <script src="./main.ts"></script>
<link rel="stylesheet" href="./index.css"></link>
</head>
<body>
hallo world 👋
</body>`,
  )

  repl.writeFile('index.css', `body { font-size: 32pt; }`)

  repl.writeFile(
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
        oninput={e => repl.writeFile(selectedPath(), e.target.value)}
        value={repl.readFile(selectedPath())}
      ></textarea>
      <iframe src={repl.getExecutable('index.html')}></iframe>
    </>
  )
}
