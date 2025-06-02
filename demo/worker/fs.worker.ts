import { createSyncFileSystem, makeVirtualFileSystem } from '@solid-primitives/filesystem'
import {
  createFileUrlSystem,
  createMonacoTypeDownloader,
  isUrl,
  resolvePath,
  transformHtmlWorker,
  transformModulePaths,
} from 'src'
import { Transform } from 'src/types'
import ts from 'typescript'
import toolkitDeclaration from '../lib/repl-toolkit.d.ts?raw'
import toolkit from '../lib/repl-toolkit.js?raw'

const typeDownloader = createMonacoTypeDownloader({
  target: 2,
  esModuleInterop: true,
})
typeDownloader.addDeclaration('@bigmistqke/repl/index.d.ts', toolkitDeclaration, '@bigmistqke/repl')

const transformJs: Transform = ({ path, source, fileUrls }) => {
  return transformModulePaths(source, modulePath => {
    if (modulePath === '@bigmistqke/repl') {
      return localModules.getFileUrl('repl-toolkit.js')
    } else if (modulePath.startsWith('.')) {
      // Swap relative module-path out with their respective module-url
      const url = fileUrls.get(resolvePath(path, modulePath))
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

const fs = createSyncFileSystem(makeVirtualFileSystem())
const fileUrls = createFileUrlSystem(fs.readFile, {
  css: { type: 'css' },
  js: {
    type: 'javascript',
    transform: transformJs,
  },
  ts: {
    type: 'javascript',
    transform({ path, source, fileUrls }) {
      return transformJs({
        path,
        source: ts.transpile(source, typeDownloader.tsconfig()),
        fileUrls,
      })
    },
  },
  html: {
    type: 'html',
    transform(config) {
      const html = transformHtmlWorker(config)
        // Transform content of all `<script type="module" />` elements
        .transformModuleScriptContent(transformJs)
        // Bind relative `src`-attribute of all `<script/>` elements to FileSystem
        .transformScriptSrc()
        // Bind relative `href`-attribute of all `<link/>` elements to FileSystem
        .transformLinkHref()
        .toString()
      return html
    },
  },
})

const localFs = createSyncFileSystem(makeVirtualFileSystem())
// Add file-system for local modules
const localModules = createFileUrlSystem(localFs.readFile, {
  js: {
    type: 'javascript',
    transform: transformJs,
  },
})
localFs.writeFile('repl-toolkit.js', toolkit)

const methods = {
  fs,
  fileUrls,
}

// Export types of methods to infer the WorkerProxy's type
export type Methods = typeof methods
export default {}
