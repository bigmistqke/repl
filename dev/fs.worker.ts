import { createEffect } from 'solid-js'
import { createExtension, createFileSystem, FileType, Transform } from 'src/create-filesystem'
import { createMonacoTypeDownloader, Monaco } from 'src/monaco'
import { parseHtmlWorker } from 'src/parse-html-worker'
import { isUrl, resolvePath } from 'src/path'
import { transformModulePaths } from 'src/transform-module-paths'
import ts from 'typescript'
import toolkitDeclaration from './lib/repl-toolkit.d.ts?raw'
import toolkit from './lib/repl-toolkit.js?raw'
import { registerMethods } from './worker-proxy'

const typeDownloader = createMonacoTypeDownloader({
  target: Monaco.ScriptTarget.ES2015,
  esModuleInterop: true,
})
typeDownloader.addDeclaration('@bigmistqke/repl/index.d.ts', toolkitDeclaration, '@bigmistqke/repl')

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
      const html = parseHtmlWorker(config)
        // Transform content of all `<script type="module" />` elements
        .transformModuleScriptContent(transformJs)
        // Bind relative `src`-attribute of all `<script/>` elements to FileSystem
        .bindScriptSrc()
        // Bind relative `href`-attribute of all `<link/>` elements to FileSystem
        .bindLinkHref()
        .toString()
      return html
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

const methods = {
  watchTsconfig(cb: (tsconfig: Monaco.CompilerOptions) => void) {
    createEffect(() => {
      cb(typeDownloader.tsconfig)
    })
  },
  watchTypes(cb: (types: Record<string, string>) => void) {
    createEffect(() => {
      cb({ ...typeDownloader.types })
    })
  },
  watchUrl(path: string, cb: (url: string | undefined) => void) {
    createEffect(() => cb(fs.url(path)))
  },
  watchFile(path: string, cb: (url: string | undefined) => void) {
    createEffect(() => cb(fs.readFile(path)))
  },
  watchDir(path: string, cb: (paths: Array<{ type: FileType | 'dir'; path: string }>) => void) {
    createEffect(() => cb(fs.readdir(path, { withFileTypes: true })))
  },
  watchPaths(cb: (paths: Array<string>) => void) {
    createEffect(() => cb(fs.paths()))
  },
  ...fs,
}

// Initialize worker-methods
registerMethods(methods)

// Export types of methods to infer the WorkerProxy's type
export type Methods = typeof methods
