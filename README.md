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
  transformModulePaths
} from '@bigmistqke/repl'
import ts from 'typescript'

function transformJs(){
  transformModulePaths(source, modulePath => {
    if (modulePath.startsWith('.')) {
      // Swap relative module-path out with their respective module-url
      const url = fs.url(resolvePath(path, modulePath))
      if (!url) throw 'url is undefined'
      return url
    } else if (modulePath.startsWith('http:') || modulePath.startsWith('https:')) {
      // Return url directly
      return modulePath
    } else {
      // Wrap external modules with esm.sh
      return `https://esm.sh/${modulePath}`
    }
  })
}

const fs = createFileSystem({
  js: createExtension({
    type: 'javascript',
    transform: transformJs
  }),
  ts: createExtension({
    type: 'javascript',
    transform(path, source, fs){
      return ts.transpile(transformJs(path, source, fs))
    }
  }),
  html: createExtension({
    type: 'html',
    transform(path, source, fs){
      return (
        parseHtml(source)
          // Process module-paths of module-scripts
          .select('script[type="module"]', (script: HTMLScriptElement) => {
            if (script.type !== 'module' || !script.textContent) return
            script.textContent = transform.js(path, script.textContent, fs)
          })
          // Process src-attribute of relative imports of scripts
          .select(
            'script[src]:not([src^="http:"]):not([src^="https:"])',
            (script: HTMLScriptElement) => {
              const url = fs.url(resolvePath(path, script.getAttribute('src')!))
              if (url) script.setAttribute('src', url)
            },
          )
          // Process href-attribute of all stylesheet links
          .select('link[rel="stylesheet"][href]', (link: HTMLLinkElement) => {
            const url = fs.url(resolvePath(path, link.getAttribute('href')!))
            if (url) link.setAttribute('href', url)
          })
          .toString()
      )
    },
  }),
})

fs.writeFile('index.html', '<script src="./main.ts"></script>')
fs.writeFile('index.ts', 'setTimeout(() => document.body.background = "blue", 1000)')

return <iframe src={fs.url('index.html')}/>
```