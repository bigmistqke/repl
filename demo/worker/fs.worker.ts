import { createSyncFileSystem, makeVirtualFileSystem } from '@solid-primitives/filesystem'
import {
  createFileUrlSystem,
  createMonacoTypeDownloader,
  defaultFileUrlSystem,
  isUrl,
  resolvePath,
  transformModulePaths,
} from 'src'
import type { Transform } from 'src/types'
import ts from 'typescript'
import toolkitDeclaration from '../lib/repl-toolkit.d.ts?raw'
import toolkit from '../lib/repl-toolkit.js?raw'

const typeDownloader = createMonacoTypeDownloader({
  ts,
  tsconfig: {
    target: 2,
    esModuleInterop: true,
  },
})
typeDownloader.addDeclaration('@bigmistqke/repl/index.d.ts', toolkitDeclaration, '@bigmistqke/repl')

const transformJs: Transform = ({ path, source, fileUrls }) => {
  return transformModulePaths({
    ts,
    source,
    transform(modulePath) {
      if (modulePath === '@bigmistqke/repl') {
        return localModules.get('repl-toolkit.js')!
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
    },
  })!
}

const fs = createSyncFileSystem(makeVirtualFileSystem())
const fileUrls = defaultFileUrlSystem({
  readFile: fs.readFile,
  ts,
})

const localFs = createSyncFileSystem(makeVirtualFileSystem())
// Add file-system for local modules
const localModules = createFileUrlSystem({
  readFile: localFs.readFile,
  extensions: {
    js: {
      type: 'javascript',
      transform: transformJs,
    },
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
