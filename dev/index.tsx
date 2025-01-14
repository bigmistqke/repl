import {
  createFile,
  createFileSystem,
  FileSystem,
  FileType,
  transformModulePaths,
} from '@bigmistqke/repl'
import { Split } from '@bigmistqke/solid-grid-split'
import tsx from 'shiki/langs/tsx.mjs'
import minLight from 'shiki/themes/min-light.mjs'
import { createMemo, createSelector, createSignal, Index } from 'solid-js'
import { render, Show } from 'solid-js/web'
import { ShikiTextarea } from 'solid-shiki-textarea'
import ts from 'typescript'
import './styles.css'

function relativeToAbsolutePath(currentPath: string, relativePath: string) {
  const base = new URL(currentPath, 'http://example.com/')
  const absoluteUrl = new URL(relativePath, base)
  return absoluteUrl.pathname
}

const [selectedPath, setSelectedPath] = createSignal<string>('main.ts')
const isPathSelected = createSelector(selectedPath)

function processJs(fs: FileSystem, path: string, source: string, typescript?: boolean) {
  // 1. Parse imports
  source = transformModulePaths(source, path => {
    try {
      if (path.startsWith('.')) {
        // 2. Swap relative module-path out with their respective module-url
        const url = fs.url(relativeToAbsolutePath(path, path))
        if (!url) throw `url is undefined`
        return url
      } else if (path.startsWith('http:') || path.startsWith('https:')) {
        // 3. Return urls directly
        return path
      } else {
        // 4. Wrap external modules with esm.sh
        return `https://esm.sh/${path}`
      }
    } catch (error) {
      throw error
    }
  })!

  if (typescript) {
    // 4. Transpile to js
    source = ts.transpile(source, {
      target: 2,
      module: 5,
      jsx: 1,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      forceConsistentCasingInFileNames: true,
      isolatedModules: true,
      resolveJsonModule: true,
      strict: true,
      noEmit: false,
      outDir: './dist',
    })
  }

  return source
}

// Create a new DOMParser and XMLSerializer-instance
const domParser = new DOMParser()
const xmlSerializer = new XMLSerializer()

function processHtml(fs: FileSystem, path: string, source: string) {
  // Parse the HTML string into a DOM Document
  const doc = domParser.parseFromString(source, 'text/html')

  Array.from(
    // Query all script-elements with type module
    doc.querySelectorAll<HTMLScriptElement>('script[type="module"]'),
  ).forEach(script => {
    if (script.type === 'module' && script.textContent) {
      script.textContent = processJs(fs, path, script.textContent)
    }
  })

  Array.from(
    // Query all script-elements with relative src
    doc.querySelectorAll<HTMLScriptElement>('script[src]:not([src^="http:"]):not([src^="https:"])'),
  ).forEach(script => {
    // Swap the src with the data-url of the corresponding file
    const src = script.getAttribute('src')!
    const absolutePath = relativeToAbsolutePath(path, src)
    const url = fs.url(absolutePath)
    if (url) {
      script.setAttribute('src', url)
    }
  })

  Array.from(
    // Query all stylesheet link-elements
    doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]'),
  ).forEach(link => {
    // Swap the href with the data-url of the corresponding file
    const href = link.getAttribute('href')!
    const absolutePath = relativeToAbsolutePath(path, href)
    const url = fs.url(absolutePath)
    if (url) {
      link.setAttribute('href', url)
    }
  })

  return xmlSerializer.serializeToString(doc)
}

const fs = createFileSystem({
  html: (path, initial, fs) =>
    createFile({
      type: 'html',
      initial,
      transform: source => processHtml(fs, path, source),
    }),
  css: (_, initial) =>
    createFile({
      type: 'css',
      initial,
    }),
  ts: (path, initial, fs) =>
    createFile({
      type: 'javascript',
      initial,
      transform: source => processJs(fs, path, source, true),
    }),
  js: (path, initial, fs) =>
    createFile({
      type: 'javascript',
      initial,
      transform: source => processJs(fs, path, source, false),
    }),
})

fs.writeFile(
  'main.ts',
  `import * as x from "https://pkg.pr.new/bigmistqke/repl/@bigmistqke/repl@6"
console.log(x)
  document.body.style.background = "yellow"
export const hallo = () => 'hallo'`,
)
fs.writeFile(
  'index.css',
  `body {
   background: yellow;  
}`,
)
fs.writeFile('index.html', `<link rel="stylesheet" href="./index.css" />`)

render(function App() {
  return (
    <Split style={{ height: '100vh' }}>
      <Split.Pane size="250px" style={{ display: 'grid', 'align-content': 'start' }}>
        <DirEnt path="" layer={0} type="dir" />
      </Split.Pane>
      <Handle />
      <Split.Pane style={{ display: 'flex' }}>
        <ShikiTextarea
          lang={tsx}
          theme={minLight}
          style={{ flex: 1 }}
          value={fs.readFile(selectedPath()) ?? ''}
          onInput={e => fs.writeFile(selectedPath(), e.target.value)}
        />
      </Split.Pane>
      <Handle />
      <Split.Pane style={{ display: 'grid' }}>
        <iframe
          src={fs.url('index.html')}
          style={{ height: '100%', width: '100%', border: 'none' }}
        />
      </Split.Pane>
    </Split>
  )
}, document.getElementById('root')!)

/**********************************************************************************/
/*                                                                                */
/*                                    File Tree                                   */
/*                                                                                */
/**********************************************************************************/

function Dir(props: { name: string; layer: number; path: string }) {
  const [collapsed, setCollapsed] = createSignal(false)
  const childDirEnts = createMemo(() => fs.readdir(props.path, { withFileTypes: true }))
  return (
    <>
      <Show when={props.path}>
        <div
          style={{
            'padding-left': props.layer * 10 + 'px',
            display: 'grid',
            'grid-template-columns': '1fr 30px',
          }}
        >
          <span>{props.name}</span>
          <Show when={childDirEnts().length !== 0}>
            <button
              style={{ 'text-align': 'center' }}
              onClick={() => setCollapsed(collapsed => !collapsed)}
            >
              {collapsed() ? '+' : '-'}
            </button>
          </Show>
        </div>
      </Show>
      <Show when={!collapsed()}>
        <Index each={childDirEnts()}>
          {dirEnt => {
            return <DirEnt layer={props.layer + 1} path={dirEnt().path} type={dirEnt().type} />
          }}
        </Index>
      </Show>
    </>
  )
}

function DirEnt(props: { layer: number; path: string; type: FileType | 'dir' }) {
  const name = () => {
    const parts = props.path.split('/')
    return parts[parts.length - 1] || ''
  }
  return (
    <Show
      when={props.type === 'dir'}
      fallback={
        <button
          style={{
            'padding-left': props.layer * 10 + 'px',
            'text-decoration': isPathSelected(props.path) ? 'underline' : 'none',
          }}
          onClick={() => setSelectedPath(props.path)}
        >
          {name()}
        </button>
      }
    >
      <Dir layer={props.layer} path={props.path} name={name()} />
    </Show>
  )
}

function Handle() {
  return (
    <Split.Handle size="10px" style={{ display: 'flex', padding: '0px 4px', cursor: 'ew-resize' }}>
      <div style={{ background: 'black', flex: 1 }} />
    </Split.Handle>
  )
}
