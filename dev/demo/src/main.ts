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

const transform = {
  js: (path, source, fs) => {
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
  },
  ts: (path, source, fs): string => {
    return ts.transpile(transform.js(path, source, fs), {
      target: 2,
      module: 5,
    })
  },
  html: (path, source, fs) => {
    return (
      parseHtml(source)
        // Process module-paths of module-scripts
        .select('script[type="module"]', (script: HTMLScriptElement) => {
          if (script.type !== 'module' || !script.textContent) return
          script.textContent = transform.js(path, script.textContent, fs)
        })
        // Process src-attribute of relative imports of scripts
        .select(
          'script[src]:not([src^="http:"]):not([src^="https:"])',
          (script: HTMLScriptElement) => {
            const url = fs.url(resolvePath(path, script.getAttribute('src')!))
            if (url) script.setAttribute('src', url)
          },
        )
        // Process href-attribute of all stylesheet links
        .select('link[rel="stylesheet"][href]', (link: HTMLLinkElement) => {
          const url = fs.url(resolvePath(path, link.getAttribute('href')!))
          if (url) link.setAttribute('href', url)
        })
        .toString()
    )
  },
} satisfies Record<string, Transform>

render(() => {
  const [selectedPath, setSelectedPath] = createSignal<string>('index.html')

  const fs = createFileSystem({
    ts: createExtension({
      type: 'javascript',
      transform: transform.ts,
    }),
    css: createExtension({
      type: 'css',
    }),
    html: createExtension({
      type: 'html',
      transform: transform.html,
    }),
  })

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

  fs.writeFile('index.css', `body { font-size: 32pt; }`)

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

  const Button = (props: { path: string }) =>
    html`<button onclick="${() => setSelectedPath(props.path)}">${props.path}</button>`

  return html`<div class="repl">
    <div style="display: flex; align-content: start; gap: 5px;">
      <${Button} path="index.html" />
      <${Button} path="index.css" />
      <${Button} path="main.ts" />
    </div>
    <textarea
      oninput=${e => fs.writeFile(selectedPath(), e.target.value)}
      value=${() => fs.readFile(selectedPath())}
    ></textarea>
    <iframe src=${() => fs.url('index.html')}></iframe>
  </div> `
}, document.getElementById('root')!)
