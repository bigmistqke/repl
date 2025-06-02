/**********************************************************************************/
/*                                                                                */
/*                                 Window Messaging                               */
/*                                                                                */
/**********************************************************************************/

import { FileType, getExtension } from '@bigmistqke/repl'
import { Split } from '@bigmistqke/solid-grid-split'
import { type WorkerProxy } from '@bigmistqke/worker-proxy'
import loader from '@monaco-editor/loader'
import { languages } from 'monaco-editor'
import {
  createEffect,
  createResource,
  createSelector,
  createSignal,
  Index,
  mapArray,
  mergeProps,
  onCleanup,
  Setter,
} from 'solid-js'
import { Show } from 'solid-js/web'
import demo from './demo'
import './styles.css'
import { every, whenEffect, whenMemo } from './utils/conditionals'
import { type Methods } from './worker/fs.worker'
import Worker from './worker/fs.worker?worker'

/**********************************************************************************/
/*                                                                                */
/*                                      Repl                                      */
/*                                                                                */
/**********************************************************************************/

export function App() {
  const [selectedPath, setSelectedPath] = createSignal<string>('main.ts')
  const isPathSelected = createSelector(selectedPath)
  const [url, setUrl] = createSignal<string>()
  const [tsconfig, setTsconfig] = createSignal<languages.typescript.CompilerOptions>({})
  const [types, setTypes] = createSignal<Record<string, string>>()

  const proxy = new Worker()

  fs.watchTsconfig(setTsconfig)
  fs.watchTypes(setTypes)
  fs.watchExecutable('index.html', setUrl)

  // Add demo's source-files to the file-system
  Object.entries(demo).forEach(([key, source]) => {
    fs.writeFile(key, source)
  })

  return (
    <Split style={{ height: '100vh' }}>
      <Split.Pane size="150px" style={{ display: 'grid', 'align-content': 'start' }}>
        <FileTree fs={fs} onPathSelect={setSelectedPath} isPathSelected={isPathSelected} />
      </Split.Pane>
      <Handle />
      <Split.Pane style={{ display: 'grid' }}>
        <Editor fs={fs} path={selectedPath()} types={types()} tsconfig={tsconfig()} />
      </Split.Pane>
      <Handle />
      <Split.Pane style={{ display: 'grid' }}>
        <iframe src={url()} style={{ height: '100%', width: '100%', border: 'none' }} />
      </Split.Pane>
    </Split>
  )
}

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
  fs: WorkerProxy<Methods>
  path: string
  types?: Record<string, string>
  tsconfig: languages.typescript.CompilerOptions
  languages?: Record<string, string>
}) {
  const [paths, setPaths] = createSignal<Array<string>>([])
  const [monaco] = createResource(() => loader.init())
  const [element, setElement] = createSignal<HTMLDivElement>()

  const editor = whenMemo(every(monaco, element), ([monaco, element]) => {
    return monaco.editor.create(element, {
      value: '',
      language: 'typescript',
      automaticLayout: true,
    })
  })

  createEffect(() => props.fs.watchPaths(setPaths))

  whenEffect(every(monaco, editor), ([monaco, editor]) => {
    const languages = mergeProps(
      {
        tsx: 'typescript',
        ts: 'typescript',
      },
      () => props.languages,
    )

    async function getType(path: string) {
      let type: string = await props.fs.$async.getType(path)
      const extension = getExtension(path)
      if (extension && extension in languages) {
        type = languages[extension]!
      }
      return type
    }

    createEffect(() => {
      editor.onDidChangeModelContent(event => {
        props.fs.writeFile(props.path, editor.getModel()!.getValue())
      })
    })

    createEffect(
      mapArray(paths, path => {
        createEffect(async () => {
          const type = await getType(path)
          if (type === 'dir') return
          const uri = monaco.Uri.parse(`file:///${path}`)
          const model = monaco.editor.getModel(uri) || monaco.editor.createModel('', type, uri)
          props.fs.watchFile(path, value => {
            if (value !== model.getValue()) {
              model.setValue(value || '')
            }
          })
          onCleanup(() => model.dispose())
        })
      }),
    )

    createEffect(async () => {
      const uri = monaco.Uri.parse(`file:///${props.path}`)
      let type = await getType(props.path)
      const model = monaco.editor.getModel(uri) || monaco.editor.createModel('', type, uri)
      editor.setModel(model)
    })

    createEffect(() => {
      if (props.tsconfig) {
        monaco.languages.typescript.typescriptDefaults.setCompilerOptions(props.tsconfig)
        monaco.languages.typescript.javascriptDefaults.setCompilerOptions(props.tsconfig)
      }
    })

    createEffect(
      mapArray(
        () => Object.keys(props.types ?? {}),
        name => {
          createEffect(() => {
            const declaration = props.types?.[name]
            if (!declaration) return
            const path = `file:///${name}`
            monaco.languages.typescript.typescriptDefaults.addExtraLib(declaration, path)
            monaco.languages.typescript.javascriptDefaults.addExtraLib(declaration, path)
          })
        },
      ),
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
  fs: WorkerProxy<Methods>
  isPathSelected: (path: string) => boolean
  onPathSelect: Setter<string>
}) {
  function Dir(props: { name: string; layer: number; path: string }) {
    const [collapsed, setCollapsed] = createSignal(false)
    const [childDirEnts, setChildDirEnts] = createSignal<
      {
        type: 'dir' | FileType
        path: string
      }[]
    >([])

    createEffect(() => treeProps.fs.watchDir(props.path, setChildDirEnts))

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
