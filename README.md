<p>
  <img width="100%" src="https://assets.solidjs.com/banner?type=@bigmistqke/repl&background=tiles&project=%20" alt="@bigmistqke/repl">
</p>

# @bigmistqke/repl

`@bigmistqke/repl` provides utilities to compose online code editors and REPLs. It manages file transformations and generates executable URLs for browser-based code execution.

## Table of Contents

- [Quick Start](#quick-start)
- [createFileUrlSystem](#createfileurlsystem)
  - [defaultFileUrlSystem](#defaultfileurlsystem)
- [Extensions](#extensions)
  - [Convenience Utilities](#convenience-utilities)
- [Utilities](#utilities)
  - [transformModulePaths](#transformmodulepaths)
  - [getModulePathRanges](#getmodulepathranges)
  - [transformHtml](#transformhtml)
  - [transformHtmlWorker](#transformhtmlworker)
  - [babelTransform](#babeltransform)
  - [createFileUrl](#createfileurl)
  - [downloadTypesFromUrl](#downloadtypesfromurl)
  - [Download Types](#download-types)
  - [Monaco Editor Integration](#monaco-editor-integration)
  - [PathUtils](#pathutils)
  - [resolvePackageEntries](#resolvepackageentries)
- [Advanced Examples](#advanced-examples)
  - [Reactive Extensions](#reactive-extensions)
  - [Template Engine](#template-engine)
  - [File System with Auto-updates](#file-system-with-auto-updates)
  - [Babel JSX Extension](#babel-jsx-extension)
- [License](#license)

## Quick Start

Create a simple code playground with custom extensions:

```tsx
import { createFileUrlSystem, transformModulePaths, PathUtils, type Extension } from '@bigmistqke/repl'
import ts from 'typescript'

// Custom JavaScript extension with module resolution
const jsExtension = {
  type: 'javascript',
  transform: ({ source, path, fileUrls }) => {
    return transformModulePaths({
      ts,
      source,
      transform: (modulePath) => {
        if (modulePath.startsWith('.')) {
          return fileUrls.get(PathUtils.resolvePath(path, modulePath))
        }
        return `https://esm.sh/${modulePath}`
      }
    })
  }
} satisfies Extension

// Custom TypeScript extension
const tsExtension = {
  type: 'javascript', 
  transform: ({ source, path, fileUrls }) => {
    // Transpile TypeScript first
    const jsSource = ts.transpile(source)
    // Then transform modules
    return jsExtension.transform({ source: jsSource, path, fileUrls })
  }
} satisfies Extension

// Create file URL system
const fileUrls = createFileUrlSystem({
  readFile: (path) => files[path],
  extensions: {
    js: jsExtension,
    ts: tsExtension,
    css: { type: 'css' },
    html: { type: 'html' }
  }
})

// File contents
const files = {
  '/index.html': '<script type="module" src="./main.ts"></script>',
  '/main.ts': 'console.log("Hello from TypeScript!")',
  '/style.css': 'body { background: blue; }'
}

// Get executable URL
const url = fileUrls.get('/index.html')

// Use in iframe
return <iframe src={url} />
```

For convenience, you can also use pre-built utilities:

```tsx
import { defaultFileUrlSystem } from '@bigmistqke/repl'

// Pre-configured with JS/TS/HTML/CSS support
const fileUrls = defaultFileUrlSystem({
  readFile: (path) => files[path],
  ts // TypeScript compiler
})
```

## createFileUrlSystem

Creates a system for managing file URLs with automatic lifecycle management:

```tsx
import { createFileUrlSystem } from '@bigmistqke/repl'

const fileUrls = createFileUrlSystem({
  readFile: (path) => myFileSystem.read(path),
  extensions: {
    css: { type: 'css' },
    scss: sassExtension,
    js: bundlerExtension,
    // ... more extensions
  }
})

// Get URL for a file (automatically managed)
const url = fileUrls.get('/src/main.js')

// Invalidate cached URL when file changes
fileUrls.invalidate('/src/main.js')
```

### defaultFileUrlSystem

Pre-configured file URL system with common file types:

```tsx
import { defaultFileUrlSystem } from '@bigmistqke/repl'

// Pre-configured with JS/TS/HTML/CSS support
const fileUrls = defaultFileUrlSystem({
  readFile: (path) => files[path],
  ts // TypeScript compiler
})
```

## Extensions

Extensions are simple objects that define how files are transformed. The core interface is:

```tsx
interface Extension {
  type: FileType // 'javascript' | 'css' | 'html' | 'wasm' | 'plain'
  transform?: (config: TransformConfig) => string | Accessor<string>
}

interface TransformConfig {
  path: string        // File path being transformed
  source: string      // File content
  fileUrls: FileUrlSystem // Access to other file URLs
}
```

**Simple extension examples:**

```tsx
// CSS extension (no transformation needed)
const cssExtension = {
  type: 'css'
}

// Custom Sass extension
const sassExtension = {
  type: 'css',
  transform: ({ source }) => {
    return sass.renderSync({ data: source }).css.toString()
  }
}

// Custom JavaScript bundler
const bundlerExtension = {
  type: 'javascript',
  transform: ({ source, path, fileUrls }) => {
    // Transform imports to use file URLs
    return transformModulePaths(source, (modulePath) => {
      if (modulePath.startsWith('.')) {
        return fileUrls.get(resolvePath(path, modulePath))
      }
      return `https://esm.sh/${modulePath}`
    })
  }
}
```

### Convenience Utilities

For common use cases, convenience utilities are provided:

```tsx
import { createJSExtension } from '@bigmistqke/repl'

// JavaScript extension with TypeScript support
const jsExtension = createJSExtension({
  ts, // TypeScript compiler
  readFile: fs.readFile,
  transpile: false, // Don't transpile by default
  transform: ({ source, path }) => {
    // Custom transformation
    return transformedSource
  }
})

// Extend to create a TypeScript variant
const tsExtension = jsExtension.extend({ 
  transpile: true // Enable transpilation
})
```

## Utilities

### transformModulePaths

Transform import/export declarations in JavaScript/TypeScript:

```tsx
const transformed = transformModulePaths({
  ts,
  source,
  transform: (modulePath) => {
    if (modulePath.startsWith('.')) {
      return fileUrls.get(PathUtils.resolvePath(currentPath, modulePath))
    }
    return `https://esm.sh/${modulePath}`
  }
})
```

### getModulePathRanges

Extract all module path ranges from TypeScript source code. This utility finds import and export declarations and returns their module specifier positions:

```tsx
import { getModulePathRanges } from '@bigmistqke/repl'

const ranges = getModulePathRanges({
  ts,
  source: `
    import { foo } from "./bar.js"
    export { baz } from "../qux.ts"
  `
})

// Returns:
// [
//   { start: 21, end: 30, path: "./bar.js", isImport: true },
//   { start: 53, end: 63, path: "../qux.ts", isImport: false }
// ]
```

This is useful for analyzing module dependencies, building custom transformations, or creating tooling that needs to understand module structure.

### transformHtml

Transform HTML content with a jQuery-like API:

```tsx
transformHtml({
  readFile,
  path: '/index.html',
  source: htmlContent
})
  // Transform all script contents
  .transformScriptContent(({ source }) => transformJs(source))
  // Bind relative src attributes to file URLs
  .bindScriptSrc()
  // Bind relative href attributes to file URLs
  .bindLinkHref()
  .toString()
```

### transformHtmlWorker

Worker-friendly HTML transformation for environments without DOM access:

```tsx
import { transformHtmlWorker } from '@bigmistqke/repl'

// Worker-friendly HTML transformation
const transformed = transformHtmlWorker({ 
  source, 
  path, 
  fileUrls,
  transformModule: jsTransform
})
```

### babelTransform

Babel transformation support:

```tsx
import { babelTransform } from '@bigmistqke/repl'
import * as babel from '@babel/standalone'

const transform = await babelTransform({
  babel,
  presets: ['react'],
  plugins: []
})

const result = transform(source, path)
```

### createFileUrl

Creates an object URL from a text source:

```tsx
import { createFileUrl } from '@bigmistqke/repl'

// Create a URL for HTML content
const url = createFileUrl('<div>Hello World</div>', 'html')

// Create a URL for JavaScript
const jsUrl = createFileUrl('console.log("Hello")', 'javascript')

// Use in iframe
const iframe = document.createElement('iframe')
iframe.src = url
```

### downloadTypesFromUrl

Download TypeScript definitions from a URL:

```tsx
import { downloadTypesFromUrl } from '@bigmistqke/repl'

const types = await downloadTypesFromUrl({
  ts,
  url: 'https://esm.sh/react@18/index.d.ts',
  cdn: 'https://esm.sh'
})
// Returns: Record<string, string>
```

### Download Types From Package

Download TypeScript definitions from npm packages.
Relies on the CDN providing the typescript declaration via `X-TypeScript-Types` header.

You should probably use [@typescript/ata](https://www.npmjs.com/package/@typescript/ata) instead.

```tsx
import { downloadTypesfromPackageName } from '@bigmistqke/repl'

// Download types for a package
const { path, types } = await downloadTypesfromPackageName({
  ts,
  name: 'react',
  cdn: 'https://esm.sh'
})
// Returns: { path: string, types: Record<string, string> }
```

### Monaco Editor Integration

Integrate with Monaco editor for TypeScript support, uses [`downloadTypesfromPackageName`](#download-types-from-package) internally:

```tsx
import { createMonacoTypeDownloader } from '@bigmistqke/repl'

const typeDownloader = createMonacoTypeDownloader({
  ts,
  tsconfig: {
    target: monaco.languages.typescript.ScriptTarget.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs
  }
})

// Download and register types
await typeDownloader.downloadModule('react')

// Get generated tsconfig
const tsconfig = typeDownloader.tsconfig()
```

### PathUtils

Path manipulation utilities:

```tsx
import { PathUtils } from '@bigmistqke/repl'

// Get file extension
const ext = PathUtils.getExtension('/src/main.ts') // 'ts'

// Get filename
const name = PathUtils.getName('/src/main.ts') // 'main.ts'

// Get parent directory
const parent = PathUtils.getParentPath('/src/main.ts') // '/src'

// Normalize path (remove leading slashes)
const normalized = PathUtils.normalizePath('//src/main.ts') // 'src/main.ts'

// Resolve relative paths
const resolved = PathUtils.resolvePath('/src/index.js', './utils.js') // '/src/utils.js'

// Check if path is a URL
const isURL = PathUtils.isUrl('https://example.com/file.js') // true
```

### resolvePackageEntries

Resolve package entry points:

```tsx
import { resolvePackageEntries } from '@bigmistqke/repl'

const entries = resolvePackageEntries(packageJson)
```

## License

MIT