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
  - [transformHtml](#transformhtml)
  - [transformHtmlWorker](#transformhtmlworker)
  - [transformBabel](#transformbabel)
  - [Download Types](#download-types)
  - [Monaco Editor Integration](#monaco-editor-integration)
  - [resolvePackageEntries](#resolvepackageentries)
  - [ReactiveRefCount](#reactiverefcount)
- [Advanced Examples](#advanced-examples)
  - [Reactive Extensions](#reactive-extensions)
  - [Template Engine](#template-engine)
  - [File System with Auto-updates](#file-system-with-auto-updates)
  - [Babel JSX Extension](#babel-jsx-extension)
- [License](#license)

## Quick Start

Create a simple code playground with custom extensions:

```tsx
import { createFileUrlSystem, transformModulePaths, resolvePath, type Extension } from '@bigmistqke/repl'
import ts from 'typescript'

// Custom JavaScript extension with module resolution
const jsExtension = {
  type: 'javascript',
  transform: ({ source, path, fileUrls }) => {
    return transformModulePaths(source, (modulePath) => {
      if (modulePath.startsWith('.')) {
        return fileUrls.get(resolvePath(path, modulePath))
      }
      return `https://esm.sh/${modulePath}`
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
import { createJSExtension, createHTMLExtension } from '@bigmistqke/repl'

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

// HTML extension with script transformation
const htmlExtension = createHTMLExtension({
  transformModule: jsExtension.transform
})
```

## Utilities

### transformModulePaths

Transform import/export declarations in JavaScript/TypeScript:

```tsx
const transformed = transformModulePaths(source, (modulePath) => {
  if (modulePath.startsWith('.')) {
    return fileUrls.get(resolvePath(currentPath, modulePath))
  }
  return `https://esm.sh/${modulePath}`
})
```

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
import { transformHtmlWorker, createHTMLExtensionWorker } from '@bigmistqke/repl'

// Worker-friendly HTML transformation
const transformed = transformHtmlWorker({ source, path, readFile })
  .transformScriptContent(transform)
  .toString()

// Worker-friendly HTML extension
const htmlExtension = createHTMLExtensionWorker({
  transformModule: jsTransform
})
```

### transformBabel

Babel transformation support:

```tsx
import { transformBabel } from '@bigmistqke/repl'
import * as babel from '@babel/standalone'

const result = await transformBabel({
  source,
  babel,
  presets: ['react'],
  plugins: []
})
```

### Download Types From Package

Download TypeScript definitions from npm packages.
Relies on the CDN providing the typescript declaration via `X-TypeScript-Types` header.

You should probably use [@typescript/ata](https://www.npmjs.com/package/@typescript/ata) instead.

```tsx
import { downloadTypesFromPackage } from '@bigmistqke/repl'

// Download types for a package
const files = await downloadTypesFromPackage('react', {
  registry: 'https://registry.npmjs.org',
  cdn: 'https://esm.sh'
})
// Returns: { '/path/to/file.d.ts': '...contents...' }
```

### Monaco Editor Integration

Integrate with Monaco editor for TypeScript support, uses [`downloadTypesFromPackage`](#download-types-from-package) internally:

```tsx
import { createMonacoTypeDownloader } from '@bigmistqke/repl'

const typeDownloader = createMonacoTypeDownloader({
  monaco,
  ts,
  readFile: fileUrls.readFile
})

// Download and register types
await typeDownloader.download('react')

// Get generated tsconfig
const tsconfig = typeDownloader.getTsConfig()
```

### resolvePackageEntries

Resolve package entry points:

```tsx
import { resolvePackageEntries } from '@bigmistqke/repl'

const entries = resolvePackageEntries(packageJson)
```

## License

MIT