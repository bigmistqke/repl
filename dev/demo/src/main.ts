import {
  createFile,
  createFileSystem,
  resolvePath,
  transformHtml,
  transformModulePaths,
  type FileSystem,
} from '@bigmistqke/repl'
import { createSignal } from 'solid-js'
import html from 'solid-js/html'
import { render } from 'solid-js/web'
import ts from 'typescript'

function processJs(fs: FileSystem, path: string, source: string, typescript?: boolean) {
  source = transformModulePaths(source, _path => {
    if (_path.startsWith('.')) {
      // Swap relative module-path out with their respective module-url
      const url = fs.url(resolvePath(path, _path))
      if (!url) throw 'url is undefined'
      return url
    } else if (_path.startsWith('http:') || _path.startsWith('https:')) {
      // Return url directly
      return _path
    } else {
      // Wrap external modules with esm.sh
      return `https://esm.sh/${_path}`
    }
  })!

  if (typescript) {
    // Transpile to js
    source = ts.transpile(source, {
      target: 2,
      module: 5,
    })
  }

  return source
}

function processHtml(fs: FileSystem, path: string, source: string) {
  return (
    transformHtml(source)
      // Process module-paths of module-scripts
      .transform('script[type="module"]', (script: HTMLScriptElement) => {
        if (script.type !== 'module' || !script.textContent) return
        script.textContent = processJs(fs, path, script.textContent)
      })
      // Process src-attribute of relative imports of scripts
      .transform(
        'script[src]:not([src^="http:"]):not([src^="https:"])',
        (script: HTMLScriptElement) => {
          const url = fs.url(resolvePath(path, script.getAttribute('src')!))
          if (url) script.setAttribute('src', url)
        },
      )
      // Process href-attribute of all stylesheet links
      .transform('link[rel="stylesheet"][href]', (link: HTMLLinkElement) => {
        const url = fs.url(resolvePath(path, link.getAttribute('href')!))
        if (url) link.setAttribute('href', url)
      })
      .toString()
  )
}

render(() => {
  const [selectedPath, setSelectedPath] = createSignal<string>('index.html')

  const fs = createFileSystem({
    ts: (path, initial, fs) =>
      createFile({
        type: 'javascript',
        initial,
        transform: source => processJs(fs, path, source, true),
      }),
    html: (path, initial, fs) =>
      createFile({
        type: 'html',
        initial,
        transform: source => processHtml(fs, path, source),
      }),
  })

  fs.writeFile(
    'index.html',
    `<head>
  <script src="./main.ts"></script>
</head>
<body>
hallo world 👋
</body>`,
  )

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
      <${Button} path="main.ts" />
    </div>
    <textarea
      oninput=${e => fs.writeFile(selectedPath(), e.target.value)}
      value=${() => fs.readFile(selectedPath())}
    ></textarea>
    <iframe src=${() => fs.url('index.html')}></iframe>
  </div> `
}, document.getElementById('root')!)
