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
- Javascript Module Paths
  - `transformModulePaths`
    - Utility that uses `typescript` compiler to transform module paths (imports/exports)
- Download Declaration Types
  - `downloadTypesFromUrl`
    - Utility to download types from a given url
  - `downloadTypesFromPackage`
    - Utility to download types from a given package name
    - Uses `esm.sh` and `X-TypeScript-Types` header to get file's declaration types
- Monaco Editor
  - `createMonacoTypeDownloader`
    - Uses `downloadTypesFromPackage` under the hood to download types
    - Returns an object of path/declaration files to use with `addExtraLib`
    - Composes a tsconfig with `path`-aliases pointing to the declaration files
  - `bindMonaco`
    - Keep monaco's internal FileSystem in sync with our FileSystem
