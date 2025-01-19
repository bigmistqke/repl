import { last } from './utils/last'

export function resolvePath(currentPath: string, relativePath: string) {
  const pathIsUrl = isUrl(currentPath)

  const base = pathIsUrl ? currentPath : new URL(currentPath, 'http://example.com/')
  const absoluteUrl = new URL(relativePath, base)

  return pathIsUrl ? absoluteUrl.href : absoluteUrl.pathname
}

export function isUrl(path: string) {
  return path.startsWith('blob:') || path.startsWith('http:') || path.startsWith('https:')
}

export function getExtension(path: string) {
  const filename = last(path.split('/'))
  return filename?.includes('.') ? last(filename.split('.'))! : undefined
}
