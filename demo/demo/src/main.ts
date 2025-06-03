import { createFileUrlSystem, createJSExtension, transformHtml } from '@bigmistqke/repl'
import { createSyncFileSystem, makeVirtualFileSystem } from '@solid-primitives/filesystem'
import { createSignal } from 'solid-js'
import html from 'solid-js/html'
import { render } from 'solid-js/web'
import ts from 'typescript'

function createRepl() {
  const fs = createSyncFileSystem(makeVirtualFileSystem())

  const jsExtension = createJSExtension({
    ts,
    fs,
  })

  const fileUrls = createFileUrlSystem(fs.readFile, {
    css: { type: 'css' },
    js: jsExtension(false),
    ts: jsExtension(true),
    html: {
      type: 'html',
      transform(config) {
        return () =>
          transformHtml(config)
            // Transform content of all `<script type="module" />` elements
            .transformModuleScriptContent(source =>
              jsExtension(false).transform({ ...config, source }),
            )
            // Bind relative `src`-attribute of all `<script />` elements
            .transformScriptSrc()
            // Bind relative `href`-attribute of all `<link />` elements
            .transformLinkHref()
            .toString()
      },
    },
  })

  return {
    fs,
    fileUrls,
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
