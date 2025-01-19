import {
  bindMonaco,
  createExtension,
  createFileSystem,
  createMonacoTypeDownloader,
  FileSystem,
  FileType,
  isUrl,
  Monaco,
  parseHtml,
  resolvePath,
  Transform,
  transformModulePaths,
} from '@bigmistqke/repl'
import { Split } from '@bigmistqke/solid-grid-split'
import loader from '@monaco-editor/loader'
import {
  createMemo,
  createResource,
  createSelector,
  createSignal,
  Index,
  mergeProps,
  Setter,
} from 'solid-js'
import { render, Show } from 'solid-js/web'
import ts from 'typescript'
import demo from './demo'
import toolkitDeclaration from './lib/repl-toolkit.d.ts?raw'
import toolkit from './lib/repl-toolkit.js?raw'
import './styles.css'
import { every, whenEffect, whenMemo } from './utils/conditionals'

/**********************************************************************************/
/*                                                                                */
/*                                   Create Repl                                  */
/*                                                                                */
/**********************************************************************************/

function createRepl() {
  const typeDownloader = createMonacoTypeDownloader({
    target: Monaco.ScriptTarget.ES2015,
    esModuleInterop: true,
  })
  typeDownloader.addModule('@bigmistqke/repl/index.d.ts', toolkitDeclaration, '@bigmistqke/repl')

  const transformJs: Transform = ({ path, source, fs }) => {
    return transformModulePaths(source, modulePath => {
      if (modulePath === '@bigmistqke/repl') {
        return localModules.url('repl-toolkit.js')
      } else if (modulePath.startsWith('.')) {
        // Swap relative module-path out with their respective module-url
        const url = fs.url(resolvePath(path, modulePath))
        if (!url) throw 'url is undefined'
        return url
      } else if (isUrl(modulePath)) {
        // Return url directly
        return modulePath
      } else {
        typeDownloader.downloadModule(modulePath)
        // Wrap external modules with esm.sh
        return `https://esm.sh/${modulePath}`
      }
    })!
  }

  const fs = createFileSystem({
    css: createExtension({ type: 'css' }),
    js: createExtension({
      type: 'javascript',
      transform: transformJs,
    }),
    ts: createExtension({
      type: 'javascript',
      transform({ path, source, fs }) {
        return transformJs({ path, source: ts.transpile(source, typeDownloader.tsconfig), fs })
      },
    }),
    html: createExtension({
      type: 'html',
      transform(config) {
        return (
          parseHtml(config)
            // Transform content of all `<script/>` elements
            .transformScriptContent(transformJs)
            // Bind relative `src`-attribute of all `<script/>` elements to FileSystem
            .bindScriptSrc()
            // Bind relative `href`-attribute of all `<link/>` elements to FileSystem
            .bindLinkHref()
            .toString()
        )
      },
    }),
  })

  // Add file-system for local modules
  const localModules = createFileSystem({
    js: createExtension({
      type: 'javascript',
      transform: transformJs,
    }),
  })
  localModules.writeFile('repl-toolkit.js', toolkit)

  return {
    fs,
    typeDownloader,
  }
}

/**********************************************************************************/
/*                                                                                */
/*                                      Repl                                      */
/*                                                                                */
/**********************************************************************************/

render(() => {
  const [selectedPath, setSelectedPath] = createSignal<string>('main.ts')
  const isPathSelected = createSelector(selectedPath)

  const repl = createRepl()
  Object.entries(demo).forEach(([key, source]) => repl.fs.writeFile(key, source))

  // Add demo's source-files to the file-system
  return (
    <Split style={{ height: '100vh' }}>
      <Split.Pane size="150px" style={{ display: 'grid', 'align-content': 'start' }}>
        <FileTree fs={repl.fs} onPathSelect={setSelectedPath} isPathSelected={isPathSelected} />
      </Split.Pane>
      <Handle />
      <Split.Pane style={{ display: 'grid' }}>
        <Editor
          fs={repl.fs}
          path={selectedPath()}
          types={repl.typeDownloader.types}
          tsconfig={repl.typeDownloader.tsconfig}
        />
      </Split.Pane>
      <Handle />
      <Split.Pane style={{ display: 'grid' }}>
        <iframe
          src={repl.fs.url('index.html')}
          style={{ height: '100%', width: '100%', border: 'none' }}
        />
      </Split.Pane>
    </Split>
  )
}, document.getElementById('root')!)

/**********************************************************************************/
/*                                                                                */
/*                                     Handle                                     */
/*                                                                                */
/**********************************************************************************/

function Handle() {
  return (
    <Split.Handle size="10px" style={{ display: 'flex', padding: '0px 4px', cursor: 'ew-resize' }}>
      <div style={{ background: 'black', flex: 1 }} />
    </Split.Handle>
  )
}

/**********************************************************************************/
/*                                                                                */
/*                                  Monaco Editor                                 */
/*                                                                                */
/**********************************************************************************/

function Editor(props: {
  fs: FileSystem
  path: string
  types?: Record<string, string>
  tsconfig: Monaco.CompilerOptions
  languages?: Record<string, string>
}) {
  const [monaco] = createResource(() => loader.init())
  const [element, setElement] = createSignal<HTMLDivElement>()

  const editor = whenMemo(every(monaco, element), ([monaco, element]) => {
    return monaco.editor.create(element, {
      value: '',
      language: 'typescript',
      automaticLayout: true,
    })
  })

  whenEffect(every(monaco, editor), ([monaco, editor]) => {
    bindMonaco(
      mergeProps(props, {
        editor,
        monaco,
      }),
    )
  })

  return <div ref={setElement} style={{ overflow: 'hidden' }} />
}

/**********************************************************************************/
/*                                                                                */
/*                                    File Tree                                   */
/*                                                                                */
/**********************************************************************************/

function FileTree(treeProps: {
  fs: FileSystem
  isPathSelected: (path: string) => boolean
  onPathSelect: Setter<string>
}) {
  function Dir(props: { name: string; layer: number; path: string }) {
    const [collapsed, setCollapsed] = createSignal(false)
    const childDirEnts = createMemo(() => treeProps.fs.readdir(props.path, { withFileTypes: true }))
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
              'text-decoration': treeProps.isPathSelected(props.path) ? 'underline' : 'none',
            }}
            onClick={() => treeProps.onPathSelect(props.path)}
          >
            {name()}
          </button>
        }
      >
        <Dir layer={props.layer} path={props.path} name={name()} />
      </Show>
    )
  }

  return <DirEnt path="" layer={0} type="dir" />
}
