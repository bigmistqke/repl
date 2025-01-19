import {
  createExtension,
  createFileSystem,
  parseHtml,
  resolvePath,
  Transform,
  transformModulePaths,
} from '@bigmistqke/repl'
import { createSignal } from 'solid-js'
import html from 'solid-js/html'
import { render } from 'solid-js/web'
import ts from 'typescript'

function createRepl() {
  const transformJs: Transform = (path, source, fs) => {
    return transformModulePaths(source, modulePath => {
      if (modulePath.startsWith('.')) {
        // Swap relative module-path out with their respective module-url
        const url = fs.url(resolvePath(path, modulePath))
        if (!url) throw 'url is undefined'
        return url
      } else if (modulePath.startsWith('http:') || modulePath.startsWith('https:')) {
        // Return url directly
        return modulePath
      } else {
        // Wrap external modules with esm.sh
        return `https://esm.sh/${modulePath}`
      }
    })!
  }

  const jsExtension = createExtension({
    type: 'javascript',
    transform: transformJs,
  })
  const tsExtension = createExtension({
    type: 'javascript',
    transform(path, source, fs) {
      return ts.transpile(transformJs(path, source, fs))
    },
  })
  const htmlExtension = createExtension({
    type: 'html',
    transform(path, source, fs) {
      return (
        parseHtml(source)
          // Transform module-paths of module-scripts
          .select('script[type="module"]', (script: HTMLScriptElement) => {
            if (script.type !== 'module' || !script.textContent) return
            script.textContent = transformJs(path, script.textContent, fs)
          })
          // Transform src-attribute of relative imports of scripts
          .select(
            'script[src]:not([src^="http:"]):not([src^="https:"])',
            (script: HTMLScriptElement) => {
              const url = fs.url(resolvePath(path, script.getAttribute('src')!))
              if (url) script.setAttribute('src', url)
            },
          )
          // Transform href-attribute of all stylesheet links
          .select('link[rel="stylesheet"][href]', (link: HTMLLinkElement) => {
            const url = fs.url(resolvePath(path, link.getAttribute('href')!))
            if (url) link.setAttribute('href', url)
          })
          .toString()
      )
    },
  })

  return createFileSystem({
    css: createExtension({ type: 'css' }),
    html: htmlExtension,
    js: jsExtension,
    ts: tsExtension,
  })
}

render(() => {
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

  const Button = (props: { path: string }) =>
    html`<button onclick="${() => setSelectedPath(props.path)}">${props.path}</button>`

  return html`<div class="repl">
    <div style="display: flex; align-content: start; gap: 5px;">
      <${Button} path="index.html" />
      <${Button} path="index.css" />
      <${Button} path="main.ts" />
    </div>
    <textarea
      oninput=${e => repl.writeFile(selectedPath(), e.target.value)}
      value=${() => repl.readFile(selectedPath())}
    ></textarea>
    <iframe src=${() => repl.url('index.html')}></iframe>
  </div> `
}, document.getElementById('root')!)
