export function getExtension(path: string) {
  return path.split('/').slice(-1)[0]?.split('.')[1] || ''
}

export function getName(path: string) {
  const parts = path.split('/')
  return parts[parts.length - 1] || ''
}

export function getParentPath(path: string) {
  const parts = path.split('/')
  return parts.slice(0, -1).join('/')
}

export function normalizePath(path: string) {
  return path.replace(/^\/+/, '')
}

export function resolvePath(currentPath: string, relativePath: string) {
  const pathIsUrl = isUrl(currentPath)

  const base = pathIsUrl ? currentPath : new URL(currentPath, 'http://example.com/')
  const absoluteUrl = new URL(relativePath, base)

  return normalizePath(pathIsUrl ? absoluteUrl.href : absoluteUrl.pathname)
}

export function isUrl(path: string) {
  return path.startsWith('blob:') || path.startsWith('http:') || path.startsWith('https:')
}
