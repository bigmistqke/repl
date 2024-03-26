import loader, { Monaco } from '@monaco-editor/loader'
import {
  Component,
  ComponentProps,
  createEffect,
  createMemo,
  createRenderEffect,
  createResource,
  createSignal,
  splitProps,
  untrack,
} from 'solid-js'

import { all, when } from './utils'

import clsx from 'clsx'
import styles from './editor.module.css'

export const [monaco] = createResource(() => {
  try {
    return loader.init() as Promise<Monaco>
  } catch (error) {
    console.error('error', error)
    return undefined
  }
})

const [typescriptWorker, setTypescriptWorker] =
  createSignal<Awaited<ReturnType<Monaco['languages']['typescript']['getTypeScriptWorker']>>>()

createRenderEffect(() =>
  when(monaco)(async monaco => {
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      esModuleInterop: true,
    })
    const worker = await monaco.languages.typescript.getTypeScriptWorker()
    setTypescriptWorker(() => worker)
  }),
)

function modifyImportPaths(code: string, alias?: Record<string, string>) {
  return code.replace(/import ([^"']+) from ["']([^"']+)["']/g, (match, varName, path) => {
    if (alias) {
      const entries = Object.entries(alias)
      for (let i = 0; i < entries.length; i++) {
        const [key, value] = entries[i]
        if (path.startsWith(key)) {
          return `import ${varName} from "${value}"`
        }
      }
    }
    if (
      path.startsWith('blob:') ||
      path.startsWith('http:') ||
      path.startsWith('https:') ||
      path.startsWith('.')
    ) {
      return `import ${varName} from "${path}"`
    } else {
      return `import ${varName} from "https://esm.sh/${path}"`
    }
  })
}

class FS {
  filesystem: Record<string, string> = {}

  updateFile(path: string, value: string) {
    this.filesystem[path] = value
  }

  checkIfPathExists(path: string) {
    return path in this.filesystem
  }

  relativeToAbsolutePath(currentPath: string, relativePath: string) {
    const count = relativePath.match(/\.\.\//g)?.length || 0
    const newPath = [
      ...currentPath.split('/').slice(0, -(count + 1)),
      ...relativePath.split('/').slice(1),
    ].join('/')
    return newPath
  }
}

const importRegex =
  /import(?:\s+type)?\s+(?:\* as \s+\w+|\w+\s*,)?(?:\{[^}]*\}\s*)?from\s*"(.+?)";?/gs

const exportRegex = /export\s+(?:\* from|type\s+\{[^}]*\}\s*from|\{[^}]*\}\s*from)\s*"(.+?)";?/gs

const cached = new Set<string>()

const resolveTypes = async (packageName: string) => {
  if (cached.has(packageName)) return
  cached.add(packageName)

  const typeUrl = await fetch(`https://esm.sh/${packageName}`).then(result =>
    result.headers.get('X-TypeScript-Types'),
  )

  const base = typeUrl!.split('/').slice(0, -1).join('/')
  const entry = typeUrl!.split('/').slice(-1)[0]!
  const fs = new FS()

  const resolvePath = async (path: string) => {
    if (fs.checkIfPathExists(path)) return
    // set path to undefined to prevent a package from being fetched multiple times
    fs.updateFile(path, null!)
    await fetch(`${base}/${path}`)
      .then(value => value.text())
      .then(text => {
        fs.updateFile(path, text)
        return text
      })
      .then(text =>
        Promise.all(
          [...text.matchAll(importRegex), ...text.matchAll(exportRegex)].map(
            ([_, relativePath]) => {
              if (relativePath && relativePath.startsWith('.')) {
                const newPath = fs.relativeToAbsolutePath(path, relativePath)
                return resolvePath(newPath)
              }
            },
          ),
        ),
      )
  }

  await resolvePath(entry)

  Object.entries(fs.filesystem).forEach(([key, value]) => {
    if (key === entry) return
    const filePath = `file:///node_modules/${packageName}/${key}`
    monaco()!.languages.typescript.typescriptDefaults.addExtraLib(value, filePath)
  })

  monaco()!.languages.typescript.typescriptDefaults.addExtraLib(
    fs.filesystem[entry]!,
    `file:///node_modules/${packageName}/index.d.ts`,
  )
}

function resolveExternalTypes(code: string) {
  ;[...code.matchAll(/import ([^"']+) from ["']([^"']+)["']/g)].forEach(
    ([match, varName, path]) => {
      if (!path) return
      if (
        path.startsWith('blob:') ||
        path.startsWith('http:') ||
        path.startsWith('https:') ||
        path.startsWith('.')
      ) {
        return
      }
      resolveTypes(path)
    },
  )
}

export const Editor: Component<
  Omit<ComponentProps<'div'>, 'onBlur'> & {
    initialValue?: string
    onBlur?: (code: string, monaco: Monaco) => void
    onCompilation?: (module: { module: Record<string, any>; url: string }) => void
    shouldCompile?: boolean
    autoFocus?: boolean
    name: string
    alias?: Record<string, string>
    mode?: 'light' | 'dark'
  }
> = props => {
  const [, htmlProps] = splitProps(props, ['initialValue', 'onBlur'])

  let container: HTMLDivElement

  const model = createMemo(() =>
    when(monaco)(monaco =>
      monaco.editor.createModel(
        untrack(() => props.initialValue) || '',
        'typescript',
        monaco.Uri.parse(`file:///${props.name}.ts`),
      ),
    ),
  )
  const [client] = createResource(all(typescriptWorker, model), ([worker, model]) =>
    worker(model.uri),
  )
  const [code, setCode] = createSignal<string | undefined>(props.initialValue)
  const [module] = createResource(
    all(client, model, code, () => props.shouldCompile !== false),
    async ([client, model]) =>
      // use monaco's typescript-server to transpile file from ts to js
      client.getEmitOutput(`file://${model.uri.path}`).then(async result => {
        if (result.outputFiles.length > 0) {
          // get module-url of transpiled code
          const url = URL.createObjectURL(
            new Blob(
              [
                // replace local imports with respective module-urls
                modifyImportPaths(result.outputFiles[0]!.text, props.alias),
              ],
              {
                type: 'application/javascript',
              },
            ),
          )
          const module = await import(/* @vite-ignore */ url)
          return {
            url,
            module,
          }
        }
      }),
  )

  createEffect(() => {
    when(
      monaco,
      model,
    )(async (monaco, model) => {
      const editor = monaco.editor.create(container, {
        value: untrack(() => props.initialValue) || '',
        language: 'typescript',
        automaticLayout: true,
        theme: untrack(() => props.mode) === 'dark' ? 'vs-dark' : 'vs-light',
        model,
      })

      let timeout: any
      editor.onKeyUp(() => {
        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(() => resolveExternalTypes(editor.getValue()), 500)
      })

      editor.onDidBlurEditorText(() => {
        const value = editor.getValue()
        props.onBlur?.(editor.getValue(), monaco)
        model.setValue(value)
        setCode(value)
      })

      createEffect(() => {
        monaco.editor.setTheme(props.mode === 'light' ? 'vs-light' : 'vs-dark')
      })
    })
  })

  createEffect(() => when(module)(module => props.onCompilation?.(module)))

  return (
    <>
      <div class={clsx(styles['editor-container'])}>
        <div ref={container!} {...htmlProps} class={styles['editor']} />
      </div>
    </>
  )
}
