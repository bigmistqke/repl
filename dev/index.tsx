import {
  createExtension,
  createFileSystem,
  FileType,
  parseHtml,
  resolvePath,
  Transform,
  transformModulePaths,
} from '@bigmistqke/repl'
import { Split } from '@bigmistqke/solid-grid-split'
import tsx from 'shiki/langs/tsx.mjs'
import minLight from 'shiki/themes/min-light.mjs'
import { createMemo, createSelector, createSignal, Index } from 'solid-js'
import { render, Show } from 'solid-js/web'
import { ShikiTextarea } from 'solid-shiki-textarea'
import ts from 'typescript'
import demo from './demo'
import toolkit from './lib/repl-toolkit.js?raw'
import './styles.css'

const transform = {
  js: (path, source, fs) => {
    return transformModulePaths(source, modulePath => {
      if (modulePath === '@bigmistqke/repl') {
        return localModules.url('repl-toolkit.js')
      } else if (modulePath.startsWith('.')) {
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
        // Transform module-paths of module-scripts
        .select('script[type="module"]', (script: HTMLScriptElement) => {
          if (script.type !== 'module' || !script.textContent) return
          script.textContent = transform.js(path, script.textContent, fs)
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
} satisfies Record<string, Transform>

// Add file-system for local modules
const localModules = createFileSystem({
  js: createExtension({
    type: 'javascript',
    transform: transform.js,
  }),
})
localModules.writeFile('repl-toolkit.js', toolkit)

// Add file-system we expose to the user
const fs = createFileSystem({
  html: createExtension({
    type: 'html',
    transform: transform.html,
  }),
  css: createExtension({
    type: 'css',
  }),
  ts: createExtension({
    type: 'javascript',
    transform: transform.ts,
  }),
  js: createExtension({
    type: 'javascript',
    transform: transform.js,
  }),
})

// Add demo's source-files to the file-system
Object.entries(demo).forEach(([key, source]) => fs.writeFile(key, source))

/**********************************************************************************/
/*                                                                                */
/*                                      Repl                                      */
/*                                                                                */
/**********************************************************************************/

const [selectedPath, setSelectedPath] = createSignal<string>('main.ts')
const isPathSelected = createSelector(selectedPath)

render(() => {
  return (
    <Split style={{ height: '100vh' }}>
      <Split.Pane size="150px" style={{ display: 'grid', 'align-content': 'start' }}>
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
