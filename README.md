<p>
  <img width="100%" src="https://assets.solidjs.com/banner?type=@bigmistqke/repl&background=tiles&project=%20" alt="@bigmistqke/repl">
</p>

<h1 id="title">@bigmistqke/repl</h1>

`@bigmistqke/repl` provides a virtual FileSystem and a set of utilities to compose online playgrounds.

- FileSystem
  - `createFileSystem`
    - Virtual FileSystem, generates an executable module url for each source
  - `createExtension`
    - Utility to create an extension
    - Transform function to transform the source (p.ex transpile typescript, resolve module paths)
- Transform JS' Import/Export Paths
  - `transformModulePaths`
- Parse Html
  - Uses `DomParser`, `XMLSerializer` and `querySelector` under the hood to parse and transform html
- Download Declaration Types
  - `downloadTypesFromUrl`
    - Utility to download types from a given url
  - `downloadTypesFromPackage`
    - Utility to download types from a given package name
    - Uses `esm.sh` and `X-TypeScript-Types` header to get file's declaration types
- Monaco Editor Utilities
  - `createMonacoTypeDownloader`
    - Uses `downloadTypesFromPackage` under the hood to download types
    - Returns an object of path/declaration files to use with `addExtraLib`
    - Composes a tsconfig with `path`-aliases pointing to the declaration files
  - `bindMonaco`
    - Keep monaco's internal FileSystem in sync with our FileSystem

With this set of utilities it is possible to make a typescript playground in <100LOC 

```tsx
import {
  createExtension,
  createFileSystem,
  parseHtml,
  resolvePath,
  Transform,
  transformModulePaths
} from '@bigmistqke/repl'
import ts from 'typescript'

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
          // Bind relative `src`-attribute of all `<script />` elements
          .bindScriptSrc()
          // Bind relative `href`-attribute of all `<link />` elements
          .bindLinkHref()
          .toString()
      )
    },
  }),
})

fs.writeFile('index.html', '<script src="./main.ts"></script>')
fs.writeFile('index.ts', 'setTimeout(() => document.body.background = "blue", 1000)')

return <iframe src={fs.url('index.html')}/>
```