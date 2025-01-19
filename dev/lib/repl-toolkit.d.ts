// Generated by dts-bundle-generator v9.5.1

/// <reference types="babel__core" />

import { Accessor, Setter } from 'solid-js'

/**********************************************************************************/
/**********************************************************************************/
export type FileType = 'javascript' | 'css' | 'html' | 'unknown'
interface File$1 {
  type: FileType
  get: Accessor<string>
  set: Setter<string>
  transformed: AccessorWithLatest<string | undefined>
  cachedUrl: Accessor<string | undefined>
  createUrl: Accessor<string | undefined>
  invalidateUrl: () => void
}
export interface Dir {
  type: 'dir'
}
export type DirEnt = File$1 | Dir
export type DirEntType = DirEnt['type']
export type Module = Record<string, unknown>
export type Extension = (config: { path: string; source: string; fs: FileSystem$1 }) => File$1
export type Transform = (config: { path: string; source: string; fs: FileSystem$1 }) => string
type FileSystem$1 = ReturnType<typeof createFileSystem>
/**********************************************************************************/
/**********************************************************************************/
export declare function createExtension({
  type,
  transform,
}: {
  type: File$1['type']
  transform?: Transform
}): Extension
export declare function createFile({
  type,
  initial,
  transform,
}: {
  type: File$1['type']
  initial: string
  transform?: (source: string) => string | Promise<string>
}): File$1
/**********************************************************************************/
/**********************************************************************************/
export declare function createFileSystem(extensions: Record<string, Extension>): {
  url: {
    (path: string): string | undefined
    /** Invalidate the cached object-url of the corresponding file. */
    invalidate(path: string): void | undefined
    /** Create a new, uncached object-url from the corresponding file. */
    create(path: string): string | undefined
  }
  paths: () => string[]
  transformed: (path: string) => string | undefined
  getType(path: string): DirEnt['type']
  readdir: {
    (
      path: string,
      options?: {
        withFileTypes?: false
      },
    ): Array<string>
    (
      path: string,
      options: {
        withFileTypes: true
      },
    ): Array<{
      type: 'dir' | FileType
      path: string
    }>
  }
  mkdir(
    path: string,
    options?: {
      recursive?: boolean
    },
  ): void
  readFile(path: string): string | undefined
  rename(previous: string, next: string): void
  rm(
    path: string,
    options?: {
      force?: boolean
      recursive?: boolean
    },
  ): void
  writeFile(path: string, source: string): void
}
/**
 * Imports type definitions from a URL, checking if the types are already cached before importing.
 *
 * @param url The URL of the type definition to import.
 * @param [packageName] The package name associated with the type definitions.
 * @returns
 * @async
 */
export declare function downloadTypesFromUrl({
  url,
  declarationFiles,
  cdn,
}: {
  url: string
  declarationFiles?: Record<string, string>
  cdn?: string
}): Promise<Record<string, string>>
/**
 * Imports type definitions based on a package name by resolving it to a CDN path.
 *
 * @param packageName The package name whose types to import.
 * @returns
 * @async
 */
export declare function downloadTypesfromPackage({
  name,
  declarationFiles,
  cdn,
}: {
  name: string
  declarationFiles?: Record<string, string>
  cdn?: string
}): Promise<{
  path: string
  types: Record<string, string>
}>
export declare namespace Monaco {
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
  export {}
}
export declare function createMonacoTypeDownloader(tsconfig: Monaco.CompilerOptions): {
  readonly tsconfig: {
    paths: {
      [x: string]: string[]
    }
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
    jsx?: Monaco.JsxEmit
    keyofStringsOnly?: boolean
    lib?: string[]
    locale?: string
    mapRoot?: string
    maxNodeModuleJsDepth?: number
    module?: Monaco.ModuleKind
    moduleResolution?: Monaco.ModuleResolutionKind
    newLine?: Monaco.NewLineKind
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
    target?: Monaco.ScriptTarget
    traceResolution?: boolean
    resolveJsonModule?: boolean
    types?: string[]
    /** Paths used to compute primary types search locations */
    typeRoots?: string[]
    esModuleInterop?: boolean
    useDefineForClassFields?: boolean
  }
  types: Record<string, string>
  addModule(path: string, source: string, alias?: string): void
  downloadModule(name: string): Promise<void>
}
export declare function bindMonaco(config: {
  editor: Monaco.Editor
  fs: FileSystem$1
  languages?: Record<string, string>
  monaco: Monaco.Monaco
  path: string
  tsconfig?: Monaco.CompilerOptions
  types?: Record<string, string>
}): void
export declare function parseHtml({
  path,
  source,
  fs,
}: {
  path: string
  source: string
  fs: FileSystem$1
}): {
  select<T extends Element>(selector: string, callback: (element: T) => void): any
  /** Bind relative `href`-attribute of all `<link />` elements */
  bindLinkHref(): any
  /** Bind relative `src`-attribute of all `<script />` elements */
  bindScriptSrc(): any
  /** Transform content of all `<script />` elements */
  transformScriptContent(transformJs: Transform): any
  toString(): string
}
export declare function resolvePath(currentPath: string, relativePath: string): string
export declare function isUrl(path: string): boolean
export declare function getExtension(path: string): string | undefined
export type PackageJson = {
  main?: string
  module?: string
  browser?: string | Record<string, string>
  exports?: ExportsField
}
export type ExportsField = string | ExportsConditions | ExportsField[]
export type ExportsConditions = {
  '.'?: ExportsField
  browser?: ExportsField
  import?: ExportsField
  require?: ExportsField
  default?: ExportsField
  [key: string]: ExportsField | undefined
}
export type ResolveConditions = {
  browser?: boolean
  require?: boolean
  import?: boolean
}
export type ResolvedPaths = {
  [key: string]: string
}
export declare function resolvePackageEntries(
  pkg: PackageJson,
  conditions?: ResolveConditions,
): ResolvedPaths
type Transform$1 = (source: string, path: string) => string
export interface BabelConfig {
  babel?: typeof Babel | Promise<typeof Babel>
  presets?: string[]
  plugins?: (string | babel.PluginItem)[]
  cdn?: string
}
export declare function babelTransform(config: BabelConfig): Promise<Transform$1>
export declare function transformModulePaths(
  code: string,
  callback: (path: string, isImport: boolean) => string | null,
): string | undefined

export { File$1 as File, FileSystem$1 as FileSystem }

export {}
