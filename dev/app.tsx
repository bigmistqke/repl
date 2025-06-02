import {
  createFileUrlSystem,
  isUrl,
  resolvePath,
  Transform,
  transformHtml,
  transformModulePaths,
} from '@bigmistqke/repl'
import { createSyncFileSystem, makeVirtualFileSystem } from '@solid-primitives/filesystem'
import { createEffect, createSignal } from 'solid-js'
import ts from 'typescript'
import './index.css'

function createRepl() {
  const fs = createSyncFileSystem(makeVirtualFileSystem())

  const transformJs: Transform = ({ path, source, fileUrls }) => {
    return transformModulePaths(source, modulePath => {
      if (modulePath.startsWith('.')) {
        // Swap relative module-path out with their respective module-url
        const url = fileUrls.get(resolvePath(path, modulePath))
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

  const fileUrls = createFileUrlSystem(fs.readFile.bind(fs), {
    css: { type: 'css' },
    js: {
      type: 'javascript',
      transform: transformJs,
    },
    ts: {
      type: 'javascript',
      transform({ path, source, fileUrls }) {
        return transformJs({ path, source: ts.transpile(source), fileUrls })
      },
    },
    html: {
      type: 'html',
      transform(config) {
        return (
          transformHtml(config)
            // Transform content of all `<script type="module" />` elements
            .transformModuleScriptContent(transformJs)
            // Bind relative `src`-attribute of all `<script />` elements
            .transformScriptSrc()
            // Bind relative `href`-attribute of all `<link />` elements
            .transformLinkHref()
            .toString()
        )
      },
    },
  })

  return {
    fs,
    fileUrls,
  }
}

export const App = () => {
  const [selectedPath, setSelectedPath] = createSignal<string>('index.html')

  const repl = createRepl()

  repl.fs.writeFile(
    'index.html',
    `<head>
  <script src="./main.ts"></script>
<link rel="stylesheet" href="./index.css"></link>
</head>
<body>
hallo world 👋
</body>`,
  )

  createEffect(() => console.log(repl.fileUrls.get('wrong')))

  repl.fs.writeFile('index.css', `body { font-size: 32pt; }`)

  repl.fs.writeFile(
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
        oninput={e => {
          repl.fs.writeFile(selectedPath(), e.target.value)
        }}
        value={repl.fs.readFile(selectedPath())}
      ></textarea>
      <iframe src={repl.fileUrls.get('index.html')}></iframe>
    </>
  )
}
