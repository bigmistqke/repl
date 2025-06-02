import {
  createFileUrlSystem,
  isUrl,
  resolvePath,
  Transform,
  transformHtml,
  transformModulePaths,
} from '@bigmistqke/repl'
import { createSyncFileSystem, makeVirtualFileSystem } from '@solid-primitives/filesystem'
import { createSignal } from 'solid-js'
import html from 'solid-js/html'
import { render } from 'solid-js/web'
import ts from 'typescript'

function createRepl() {
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
  const fs = createSyncFileSystem(makeVirtualFileSystem())
  return {
    fs,
    filUrls: createFileUrlSystem(fs.readFile, {
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
    }),
  }
}

render(() => {
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

  const Button = (props: { path: string }) =>
    html`<button onclick="${() => setSelectedPath(props.path)}">${props.path}</button>`

  return html`<div class="repl">
    <div style="display: flex; align-content: start; gap: 5px;">
      <${Button} path="index.html" />
      <${Button} path="index.css" />
      <${Button} path="main.ts" />
    </div>
    <textarea
      oninput=${e => repl.fs.writeFile(selectedPath(), e.target.value)}
      value=${() => repl.fs.readFile(selectedPath())}
    ></textarea>
    <iframe src=${() => repl.filUrls.get('index.html')}></iframe>
  </div> `
}, document.getElementById('root')!)
