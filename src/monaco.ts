import type loader from '@monaco-editor/loader'
import { createEffect, createSignal, mapArray, mergeProps, onCleanup } from 'solid-js'
import { createStore } from 'solid-js/store'
import { FileSystem } from './create-filesystem'
import { downloadTypesfromPackage } from './download-types'
import { getExtension } from './path'
import { mapObject } from './utils/map-object'

export namespace Monaco {
  export type Monaco = Awaited<ReturnType<typeof loader.init>>
  export type Editor = ReturnType<Monaco['editor']['create']>

  export enum ModuleKind {
    None = 0,
    CommonJS = 1,
    AMD = 2,
    UMD = 3,
    System = 4,
    ES2015 = 5,
    ESNext = 99,
  }
  export enum JsxEmit {
    None = 0,
    Preserve = 1,
    React = 2,
    ReactNative = 3,
    ReactJSX = 4,
    ReactJSXDev = 5,
  }
  export enum NewLineKind {
    CarriageReturnLineFeed = 0,
    LineFeed = 1,
  }
  export enum ScriptTarget {
    ES3 = 0,
    ES5 = 1,
    ES2015 = 2,
    ES2016 = 3,
    ES2017 = 4,
    ES2018 = 5,
    ES2019 = 6,
    ES2020 = 7,
    ESNext = 99,
    JSON = 100,
    Latest = 99,
  }
  export enum ModuleResolutionKind {
    Classic = 1,
    NodeJs = 2,
  }
  interface MapLike<T> {
    [index: string]: T
  }
  export type CompilerOptionsValue =
    | string
    | number
    | boolean
    | (string | number)[]
    | string[]
    | MapLike<string[]>
    | null
    | undefined

  export interface CompilerOptions {
    allowJs?: boolean
    allowSyntheticDefaultImports?: boolean
    allowUmdGlobalAccess?: boolean
    allowUnreachableCode?: boolean
    allowUnusedLabels?: boolean
    alwaysStrict?: boolean
    baseUrl?: string
    charset?: string
    checkJs?: boolean
    declaration?: boolean
    declarationMap?: boolean
    emitDeclarationOnly?: boolean
    declarationDir?: string
    disableSizeLimit?: boolean
    disableSourceOfProjectReferenceRedirect?: boolean
    downlevelIteration?: boolean
    emitBOM?: boolean
    emitDecoratorMetadata?: boolean
    experimentalDecorators?: boolean
    forceConsistentCasingInFileNames?: boolean
    importHelpers?: boolean
    inlineSourceMap?: boolean
    inlineSources?: boolean
    isolatedModules?: boolean
    jsx?: JsxEmit
    keyofStringsOnly?: boolean
    lib?: string[]
    locale?: string
    mapRoot?: string
    maxNodeModuleJsDepth?: number
    module?: ModuleKind
    moduleResolution?: ModuleResolutionKind
    newLine?: NewLineKind
    noEmit?: boolean
    noEmitHelpers?: boolean
    noEmitOnError?: boolean
    noErrorTruncation?: boolean
    noFallthroughCasesInSwitch?: boolean
    noImplicitAny?: boolean
    noImplicitReturns?: boolean
    noImplicitThis?: boolean
    noStrictGenericChecks?: boolean
    noUnusedLocals?: boolean
    noUnusedParameters?: boolean
    noImplicitUseStrict?: boolean
    noLib?: boolean
    noResolve?: boolean
    out?: string
    outDir?: string
    outFile?: string
    paths?: MapLike<string[]>
    preserveConstEnums?: boolean
    preserveSymlinks?: boolean
    project?: string
    reactNamespace?: string
    jsxFactory?: string
    composite?: boolean
    removeComments?: boolean
    rootDir?: string
    rootDirs?: string[]
    skipLibCheck?: boolean
    skipDefaultLibCheck?: boolean
    sourceMap?: boolean
    sourceRoot?: string
    strict?: boolean
    strictFunctionTypes?: boolean
    strictBindCallApply?: boolean
    strictNullChecks?: boolean
    strictPropertyInitialization?: boolean
    stripInternal?: boolean
    suppressExcessPropertyErrors?: boolean
    suppressImplicitAnyIndexErrors?: boolean
    target?: ScriptTarget
    traceResolution?: boolean
    resolveJsonModule?: boolean
    types?: string[]
    /** Paths used to compute primary types search locations */
    typeRoots?: string[]
    esModuleInterop?: boolean
    useDefineForClassFields?: boolean
    [option: string]: CompilerOptionsValue | undefined
  }
}

export function createMonacoTypeDownloader(tsconfig: Monaco.CompilerOptions) {
  const [types, setTypes] = createStore<Record<string, string>>({})
  const [aliases, setAliases] = createSignal<Record<string, Array<string>>>({})

  function addAlias(alias: string, path: string) {
    setAliases(paths => {
      paths[alias] = [`file:///${path}`]
      return { ...paths }
    })
  }

  const methods = {
    tsconfig() {
      return {
        ...tsconfig,
        paths: {
          ...mapObject(tsconfig.paths || {}, value => value.map(path => `file:///${path}`)),
          ...aliases(),
        },
      }
    },
    types() {
      return types
    },
    addDeclaration(path: string, source: string, alias?: string) {
      setTypes(path, source)
      if (alias) {
        addAlias(alias, path)
      }
    },
    async downloadModule(name: string) {
      if (!(name in aliases())) {
        const { types, path } = await downloadTypesfromPackage({ name })
        setTypes(types)
        addAlias(name, path)
      }
    },
    // Watchers
    watchTsconfig(cb: (tsconfig: Monaco.CompilerOptions) => void) {
      createEffect(() => cb(methods.tsconfig()))
    },
    watchTypes(cb: (types: Record<string, string>) => void) {
      createEffect(() => cb({ ...types }))
    },
  }

  return methods
}

export function bindMonaco(props: {
  editor: Monaco.Editor
  fs: FileSystem
  languages?: Record<string, string>
  monaco: Monaco.Monaco
  path: string
  tsconfig?: Monaco.CompilerOptions
  types?: Record<string, string>
}) {
  const languages = mergeProps(
    {
      tsx: 'typescript',
      ts: 'typescript',
    },
    () => props.languages,
  )

  function getType(path: string) {
    let type: string = props.fs.getType(path)
    const extension = getExtension(path)
    if (extension && extension in languages) {
      type = languages[extension]!
    }
    return type
  }

  createEffect(() => {
    props.editor.onDidChangeModelContent(event =>
      props.fs.writeFile(props.path, props.editor.getModel()!.getValue()),
    )
  })

  createEffect(
    mapArray(props.fs.paths, path => {
      createEffect(() => {
        const type = getType(path)
        if (type === 'dir') return
        const uri = props.monaco.Uri.parse(`file:///${path}`)
        const model =
          props.monaco.editor.getModel(uri) || props.monaco.editor.createModel('', type, uri)
        createEffect(() => {
          const value = props.fs.readFile(path) || ''
          if (value !== model.getValue()) {
            model.setValue(props.fs.readFile(path) || '')
          }
        })
        onCleanup(() => model.dispose())
      })
    }),
  )

  createEffect(() => {
    const uri = props.monaco.Uri.parse(`file:///${props.path}`)
    let type = getType(props.path)
    const model =
      props.monaco.editor.getModel(uri) || props.monaco.editor.createModel('', type, uri)
    props.editor.setModel(model)
  })

  createEffect(() => {
    if (props.tsconfig) {
      props.monaco.languages.typescript.typescriptDefaults.setCompilerOptions(props.tsconfig)
      props.monaco.languages.typescript.javascriptDefaults.setCompilerOptions(props.tsconfig)
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
          props.monaco.languages.typescript.typescriptDefaults.addExtraLib(declaration, path)
          props.monaco.languages.typescript.javascriptDefaults.addExtraLib(declaration, path)
        })
      },
    ),
  )
}
