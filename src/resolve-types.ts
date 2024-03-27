import { Monaco } from '@monaco-editor/loader'

class FS {
  filesystem: Record<string, string> = {}

  updateFile(path: string, value: string) {
    this.filesystem[path] = value
  }

  checkIfPathExists(path: string) {
    return path in this.filesystem
  }

  relativeToAbsolutePath(currentPath: string, relativePath: string) {
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
  getVirtualPath(url: string) {
    return (
      url
        .replace('https://esm.sh/', '')
        // replace 'v128
        .split('/')
        .slice(1)
        .join('/')
    )
  }
}

const fs = new FS()

const regex = {
  import:
    /import\s+(?:type\s+)?(?:\{[^}]*\}|\* as [^\s]+|\w+\s*,\s*\{[^}]*\}|\w+)?\s+from\s*"(.+?)";?/gs,
  export:
    /export\s+(?:\{[^}]*\}|\* as [^\s]+|\*|\w+(?:,\s*\{[^}]*\})?|type \{[^}]*\})?\s+from\s*"(.+?)";?/gs,
  require: /require\s*\(["']([^"']+)["']\)/g,
}

const resolveImport = async (monaco: Monaco, url: string) => {
  const newFiles: Record<string, string> = {}

  const resolvePath = async (url: string) => {
    const virtualPath = fs.getVirtualPath(url)

    if (fs.checkIfPathExists(virtualPath)) return
    // set path to undefined to prevent a package from being fetched multiple times
    fs.updateFile(virtualPath, null!)

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
          ].map(([match, relativePath]) => {
            if (relativePath.startsWith('.')) {
              return resolvePath(fs.relativeToAbsolutePath(url, relativePath))
            } else if (relativePath.startsWith('https:')) {
              const virtualPath = fs.getVirtualPath(relativePath)
              code = code.replace(relativePath, virtualPath)
              resolveTypesFromUrl(monaco, relativePath)
            } else {
              resolveTypesFromPackageName(monaco, relativePath)
            }
          }),
        )
        return code
      })
      .then(code => {
        fs.updateFile(virtualPath, code)
        newFiles[virtualPath] = code
      })
      .catch(console.error)
  }

  await resolvePath(url)

  return newFiles
}

const cachedUrls = new Set<string>()

const resolveTypesFromUrl = async (monaco: Monaco, url: string) => {
  if (cachedUrls.has(url)) return
  cachedUrls.add(url)

  const newFiles = await resolveImport(monaco, url)

  Object.entries(newFiles).forEach(([key, value]) => {
    const filePath = `file:///esm/${key}`
    if (value) {
      monaco.languages.typescript.typescriptDefaults.addExtraLib(value, filePath)
    }
  })
}

const cachedPackageNames = new Set<string>()

const resolveTypesFromPackageName = async (monaco: Monaco, packageName: string) => {
  if (cachedPackageNames.has(packageName)) return
  cachedPackageNames.add(packageName)

  const typeUrl = await fetch(`https://esm.sh/${packageName}`).then(result =>
    result.headers.get('X-TypeScript-Types'),
  )

  if (!typeUrl) {
    console.error('no type url was found for package', packageName)
    return
  }

  const virtualPath = fs.getVirtualPath(typeUrl)

  const newFiles = await resolveImport(monaco, typeUrl)

  Object.entries(newFiles).forEach(([key, value]) => {
    const filePath = `file:///esm/${key}`
    if (value) {
      monaco.languages.typescript.typescriptDefaults.addExtraLib(value, filePath)
    }
  })

  // add virtual path to monaco's tsconfig's `path`-property
  const tsCompilerOptions = monaco.languages.typescript.typescriptDefaults.getCompilerOptions()
  tsCompilerOptions.paths[packageName] = [`file:///esm/${virtualPath}`]
  monaco.languages.typescript.typescriptDefaults.setCompilerOptions(tsCompilerOptions)
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions(tsCompilerOptions)
}

export async function resolveExternalTypes(monaco: Monaco, code: string) {
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

      return resolveTypesFromPackageName(monaco, path)
    }),
  )
}
