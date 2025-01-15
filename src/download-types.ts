import { transformModulePaths } from './parse-module-paths'

function relativeToAbsolutePath(currentPath: string, relativePath: string) {
  const base = new URL(currentPath, 'http://example.com/')
  const absoluteUrl = new URL(relativePath, base)
  return absoluteUrl.pathname
}
function isUrl(path: string) {
  return path.startsWith('blob:') || path.startsWith('http:') || path.startsWith('https:')
}

function isRelativePath(path: string) {
  return path.startsWith('.')
}

/**
 * Imports type definitions from a URL, checking if the types are already cached before importing.
 *
 * @param url The URL of the type definition to import.
 * @param [packageName] The package name associated with the type definitions.
 * @returns
 * @async
 */
export async function downloadTypesFromUrl({
  url,
  declarationFiles = {},
  cdn = 'https://www.esm.sh',
}: {
  url: string
  declarationFiles: Record<string, string>
  cdn: string
}): Promise<Record<string, string>> {
  async function resolvePath(path: string) {
    const virtualPath = getVirtualPath(path)
    if (virtualPath in declarationFiles) return

    const code = await fetch(path).then(response => {
      if (response.status !== 200) {
        throw new Error(`Error while loading ${url}`)
      }
      return response.text()
    })

    const promises = new Array<Promise<any>>()

    const transformedCode = transformModulePaths(code, modulePath => {
      if (isRelativePath(modulePath)) {
        promises.push(resolvePath(relativeToAbsolutePath(path, modulePath)))
        if (modulePath.endsWith('.js')) {
          return modulePath.replace('.js', '.d.ts')
        }
      } else if (isUrl(modulePath)) {
        const virtualPath = getVirtualPath(modulePath)
        promises.push(downloadTypesFromUrl({ url: modulePath, declarationFiles, cdn }))
        return virtualPath
      } else {
        promises.push(downloadTypesfromPackage({ name: modulePath, declarationFiles, cdn }))
      }
      return modulePath
    })

    if (!transformedCode) {
      throw new Error(`Transform returned undefined for ${virtualPath}`)
    }

    await Promise.all(promises)

    declarationFiles[virtualPath] = transformedCode
  }

  await resolvePath(url)

  return declarationFiles
}

/**
 * Imports type definitions based on a package name by resolving it to a CDN path.
 *
 * @param packageName The package name whose types to import.
 * @returns
 * @async
 */
async function downloadTypesfromPackage({
  name,
  declarationFiles = {},
  cdn = 'https://www.esm.sh',
}: {
  name: string
  declarationFiles: Record<string, string>
  cdn: string
}) {
  const typeUrl = await fetch(`${cdn}/${name}`)
    .then(result => result.headers.get('X-TypeScript-Types'))
    .catch(error => {
      console.info(error)
      return undefined
    })

  if (!typeUrl) {
    throw `no type url was found for package ${name}`
  }

  return downloadTypesFromUrl({ url: typeUrl, declarationFiles, cdn })
}

/**
 * Converts a URL into a virtual path by stripping the CDN URL and protocol.
 *
 * @param url The URL to convert.
 * @returns The virtual path derived from the URL.
 * @private
 */
function getVirtualPath(url: string, cdn = 'https://www.esm.sh') {
  return (
    url
      .replace(`${cdn}/`, '')
      // replace version-number
      .split('/')
      .slice(1)
      .join('/')
  )
}
