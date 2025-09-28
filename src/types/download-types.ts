import type TS from 'typescript'
import * as PathUtils from '../path-utils.ts'
import { transformModulePaths } from '../transform/transform-module-paths.ts'
import { defer } from '../utils.ts'

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
 * @param cdn The CDN base URL to strip from the URL. Defaults to 'https://esm.sh'.
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
 * @param params The parameters object.
 * @param params.ts The TypeScript compiler API.
 * @param params.url The URL of the type definition to import.
 * @param params.declarationFiles The existing declaration files cache. Defaults to empty object.
 * @param params.cdn The CDN base URL to use for resolving relative imports. Defaults to 'https://esm.sh'.
 * @returns A promise that resolves to the declaration files.
 * @async
 */
export async function downloadTypesFromUrl({
  ts,
  url,
  declarationFiles = {},
  cdn = 'https://esm.sh',
}: {
  ts: typeof TS
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
    const source = await response.text()

    resolve(source)

    const promises = new Array<Promise<any>>()

    const transformedCode = transformModulePaths({
      ts,
      source,
      transform(modulePath) {
        if (isRelativePath(modulePath)) {
          let newPath = PathUtils.resolvePath(path, modulePath)
          promises.push(downloadPath(normalizePath(newPath)))

          return normalizePath(modulePath)
        } else if (PathUtils.isUrl(modulePath)) {
          promises.push(
            downloadTypesFromUrl({
              ts,
              url: modulePath,
              declarationFiles,
              cdn,
            }),
          )
          return getVirtualPath(modulePath)
        } else {
          promises.push(
            downloadTypesfromPackageName({ name: modulePath, declarationFiles, cdn, ts }),
          )
        }
        return modulePath
      },
    })

    if (!transformedCode) {
      throw new Error(`Transform returned undefined for ${virtualPath}`)
    }

    await Promise.all(promises)

    declarationFiles[virtualPath] = transformedCode()
  }

  await downloadPath(url)

  return declarationFiles
}

/**********************************************************************************/
/*                                                                                */
/*                            Download Types From Package                         */
/*                                                                                */
/**********************************************************************************/

const TYPE_URL_CACHE = new Map<string, Promise<string | null>>()

/**
 * Imports type definitions based on a package name by resolving it to a CDN path.
 * Relies on the CDN providing the typescript declaration via 'X-TypeScript-Types' header.
 *
 * You should probably use [@typescript/ata](https://www.npmjs.com/package/@typescript/ata) instead.
 *
 * @param params The parameters object.
 * @param params.ts The TypeScript compiler API.
 * @param params.name The package name whose types to import.
 * @param params.declarationFiles Record to store downloaded declaration files. Defaults to empty object.
 * @param params.cdn The CDN base URL to fetch the package from. Defaults to 'https://esm.sh'.
 * @returns A promise that resolves to an object with path and types.
 * @async
 */
export async function downloadTypesfromPackageName({
  ts,
  name,
  declarationFiles = {},
  cdn = 'https://esm.sh',
}: {
  ts: typeof TS
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
    types: await downloadTypesFromUrl({ url: typeUrl, declarationFiles, cdn, ts }),
  }
}
