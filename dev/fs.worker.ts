import { createFileSystem } from 'src/create-filesystem'
import { createMonacoTypeDownloader } from 'src/monaco'
import { parseHtmlWorker } from 'src/parse-html-worker'
import { isUrl, resolvePath } from 'src/path'
import { transformModulePaths } from 'src/transform-module-paths'
import { Transform } from 'src/types'
import ts from 'typescript'
import toolkitDeclaration from './lib/repl-toolkit.d.ts?raw'
import toolkit from './lib/repl-toolkit.js?raw'

const typeDownloader = createMonacoTypeDownloader({
  target: 2,
  esModuleInterop: true,
})
typeDownloader.addDeclaration('@bigmistqke/repl/index.d.ts', toolkitDeclaration, '@bigmistqke/repl')

const transformJs: Transform = ({ path, source, executables }) => {
  return transformModulePaths(source, modulePath => {
    if (modulePath === '@bigmistqke/repl') {
      return localModules.executables.get('repl-toolkit.js')
    } else if (modulePath.startsWith('.')) {
      // Swap relative module-path out with their respective module-url
      const url = executables.get(resolvePath(path, modulePath))
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
  css: { type: 'css' },
  js: {
    type: 'javascript',
    transform: transformJs,
  },
  ts: {
    type: 'javascript',
    transform({ path, source, executables }) {
      return transformJs({
        path,
        source: ts.transpile(source, typeDownloader.tsconfig()),
        executables,
      })
    },
  },
  html: {
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
  },
})

// Add file-system for local modules
const localModules = createFileSystem({
  js: {
    type: 'javascript',
    transform: transformJs,
  },
})
localModules.writeFile('repl-toolkit.js', toolkit)

const methods = {
  watchTsconfig: typeDownloader.watchTsconfig,
  watchTypes: typeDownloader.watchTypes,
  watchExecutable: fs.watchExecutable,
  writeFile: fs.writeFile,
  watchDir: fs.watchDir,
  watchFile: fs.watchFile,
  getType: fs.getType,
  watchPaths: fs.watchPaths,
}

export default methods

// Initialize worker-methods
// export default methods

// Export types of methods to infer the WorkerProxy's type
export type Methods = typeof methods
