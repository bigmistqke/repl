import { Monaco } from '@monaco-editor/loader'

const regex = {
  import:
    /import\s+(?:type\s+)?(?:\{[^}]*\}|\* as [^\s]+|\w+\s*,\s*\{[^}]*\}|\w+)?\s+from\s*"(.+?)";?/gs,
  export:
    /export\s+(?:\{[^}]*\}|\* as [^\s]+|\*|\w+(?:,\s*\{[^}]*\})?|type \{[^}]*\})?\s+from\s*"(.+?)";?/gs,
  require: /require\s*\(["']([^"']+)["']\)/g,
}
export class TypeRegistry {
  filesystem: Record<string, string> = {}
  cachedUrls = new Set<string>()
  cachedPackageNames = new Set<string>()

  constructor(public monaco: Monaco) {}

  private updateFile(path: string, value: string) {
    this.filesystem[path] = value
  }

  private checkIfPathExists(path: string) {
    return path in this.filesystem
  }

  private relativeToAbsolutePath(currentPath: string, relativePath: string) {
    const ancestorCount = relativePath.match(/\.\.\//g)?.length || 0

    const newPath =
      ancestorCount > 0
        ? [
            ...currentPath.split('/').slice(0, -(ancestorCount + 1)),
            ...relativePath.split('/').slice(ancestorCount),
          ]
        : [...currentPath.split('/').slice(0, -1), ...relativePath.split('/').slice(1)]

    return newPath.join('/')
  }
  private getVirtualPath(url: string) {
    return (
      url
        .replace('https://esm.sh/', '')
        // replace 'v128
        .split('/')
        .slice(1)
        .join('/')
    )
  }
  async importTypesFromUrl(url: string) {
    if (this.cachedUrls.has(url)) return
    this.cachedUrls.add(url)

    const newFiles: Record<string, string> = {}

    const resolvePath = async (url: string) => {
      const virtualPath = this.getVirtualPath(url)

      if (this.checkIfPathExists(virtualPath)) return
      // set path to undefined to prevent a package from being fetched multiple times
      this.updateFile(virtualPath, null!)

      await fetch(url)
        .then(value => {
          if (value.status !== 200) throw `error while loading ${url}`
          return value
        })
        .then(value => value.text())
        .then(async code => {
          await Promise.all(
            [
              ...code.matchAll(regex.import),
              ...code.matchAll(regex.export),
              ...code.matchAll(regex.require),
            ].map(([_, path]) => {
              if (path.startsWith('.')) {
                return resolvePath(this.relativeToAbsolutePath(url, path))
              } else if (path.startsWith('https:')) {
                const virtualPath = this.getVirtualPath(path)
                code = code.replace(path, virtualPath)
                this.importTypesFromUrl(path)
              } else {
                this.importTypesFromPackageName(path)
              }
            }),
          )
          return code
        })
        .then(code => {
          this.updateFile(virtualPath, code)
          newFiles[virtualPath] = code
        })
        .catch(console.error)
    }

    await resolvePath(url)

    Object.entries(newFiles).forEach(([key, value]) => {
      const filePath = `file:///esm/${key}`
      if (value) {
        this.monaco.languages.typescript.typescriptDefaults.addExtraLib(value, filePath)
      }
    })
  }

  async importTypesFromPackageName(packageName: string) {
    if (this.cachedPackageNames.has(packageName)) return
    this.cachedPackageNames.add(packageName)

    const typeUrl = await fetch(`https://esm.sh/${packageName}`).then(result =>
      result.headers.get('X-TypeScript-Types'),
    )

    if (!typeUrl) {
      console.error('no type url was found for package', packageName)
      return
    }

    const virtualPath = this.getVirtualPath(typeUrl)

    await this.importTypesFromUrl(typeUrl)

    // add virtual path to monaco's tsconfig's `path`-property
    const tsCompilerOptions =
      this.monaco.languages.typescript.typescriptDefaults.getCompilerOptions()
    tsCompilerOptions.paths[packageName] = [`file:///esm/${virtualPath}`]
    this.monaco.languages.typescript.typescriptDefaults.setCompilerOptions(tsCompilerOptions)
    this.monaco.languages.typescript.javascriptDefaults.setCompilerOptions(tsCompilerOptions)
  }

  async importTypesFromCode(code: string) {
    await Promise.all(
      [...code.matchAll(regex.import)].map(([match, path]) => {
        if (!path) return
        if (
          path.startsWith('blob:') ||
          path.startsWith('http:') ||
          path.startsWith('https:') ||
          path.startsWith('.')
        ) {
          return
        }

        return this.importTypesFromPackageName(path)
      }),
    )
  }

  private modifyImportPaths(code: string) {
    return code.replace(/import ([^"']+) from ["']([^"']+)["']/g, (match, varName, path) => {
      if (
        path.startsWith('blob:') ||
        path.startsWith('http:') ||
        path.startsWith('https:') ||
        path.startsWith('.')
      ) {
        return `import ${varName} from "${path}"`
      } else {
        return `import ${varName} from "https://esm.sh/${path}"`
      }
    })
  }

  async transpileCodeFromModel(model: ReturnType<Monaco['editor']['createModel']>) {
    const typescriptWorker = await (
      await this.monaco.languages.typescript.getTypeScriptWorker()
    )(model.uri)
    // use monaco's typescript-server to transpile file from ts to js
    return typescriptWorker
      .getEmitOutput(`file://${model.uri.path}`)
      .then(text => (console.log(text), text))
      .then(async result => {
        if (result.outputFiles.length > 0) {
          // replace local imports with respective module-urls
          const code = this.modifyImportPaths(result.outputFiles[0]!.text)

          // get module-url of transpiled code
          const url = URL.createObjectURL(
            new Blob([code], {
              type: 'application/javascript',
            }),
          )

          const module = await import(/* @vite-ignore */ url)

          return { module, url }
        }
      })
  }
}
