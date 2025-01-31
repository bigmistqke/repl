import { resolvePath } from './path.ts'
import { transformModulePaths } from './transform-module-paths.ts'
import { defer } from './utils/defer.ts'

/**********************************************************************************/
/*                                                                                */
/*                                       Misc                                     */
/*                                                                                */
/**********************************************************************************/

function isUrl(path: string) {
  return path.startsWith('blob:') || path.startsWith('http:') || path.startsWith('https:')
}

function isRelativePath(path: string) {
  return path.startsWith('.')
}

const extensions = ['.js.d.ts', '.jsx.d.ts', '.ts.d.ts', '.tsx.d.ts', '.js', '.jsx', '.tsx']
function normalizePath(path: string) {
  for (const extension of extensions) {
    if (path.endsWith(extension)) {
      return path.replace(extension, '.d.ts')
    }
  }
  return path
}

/**
 * Converts a URL into a virtual path by stripping the CDN URL and protocol.
 *
 * @param url The URL to convert.
 * @returns The virtual path derived from the URL.
 * @private
 */
function getVirtualPath(url: string, cdn = 'https://esm.sh') {
  const [first, ...path] = url.replace(`${cdn}/`, '').split('/')
  const library = first?.startsWith('@') ? `@${first.slice(1).split('@')[0]}` : first!.split('@')[0]
  return `${library}/${path.join('/')}`
}

/**********************************************************************************/
/*                                                                                */
/*                             Download Types From Url                            */
/*                                                                                */
/**********************************************************************************/

const URL_CACHE = new Map<string, Promise<string>>()

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
  cdn = 'https://esm.sh',
}: {
  url: string
  declarationFiles?: Record<string, string>
  cdn?: string
}): Promise<Record<string, string>> {
  async function downloadPath(path: string) {
    if (URL_CACHE.has(path)) return await URL_CACHE.get(path)!

    const { promise, resolve } = defer<string>()
    URL_CACHE.set(path, promise)

    const virtualPath = getVirtualPath(path)
    if (virtualPath in declarationFiles) return

    const response = await fetch(path)
    if (response.status !== 200) {
      throw new Error(`Error while loading ${url}`)
    }
    const code = await response.text()

    resolve(code)

    const promises = new Array<Promise<any>>()

    const transformedCode = transformModulePaths(code, modulePath => {
      if (isRelativePath(modulePath)) {
        let newPath = resolvePath(path, modulePath)
        promises.push(downloadPath(normalizePath(newPath)))

        return normalizePath(modulePath)
      } else if (isUrl(modulePath)) {
        promises.push(
          downloadTypesFromUrl({
            url: modulePath,
            declarationFiles,
            cdn,
          }),
        )
        return getVirtualPath(modulePath)
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

  await downloadPath(url)

  return declarationFiles
}

/**********************************************************************************/
/*                                                                                */
/*                           Download Types From Package                          */
/*                                                                                */
/**********************************************************************************/

const TYPE_URL_CACHE = new Map<string, Promise<string | null>>()

/**
 * Imports type definitions based on a package name by resolving it to a CDN path.
 *
 * @param packageName The package name whose types to import.
 * @returns
 * @async
 */
export async function downloadTypesfromPackage({
  name,
  declarationFiles = {},
  cdn = 'https://esm.sh',
}: {
  name: string
  declarationFiles?: Record<string, string>
  cdn?: string
}) {
  const typeUrl = await (TYPE_URL_CACHE.get(name) ??
    TYPE_URL_CACHE.set(
      name,
      fetch(`${cdn}/${name}`)
        .then(result => result.headers.get('X-TypeScript-Types'))
        .catch(error => {
          console.info(error)
          return null
        }),
    ).get(name))

  if (!typeUrl) throw `No type url was found for package ${name}`

  return {
    path: getVirtualPath(typeUrl),
    types: await downloadTypesFromUrl({ url: typeUrl, declarationFiles, cdn }),
  }
}
