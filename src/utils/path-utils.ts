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
  // Handle URLs
  if (isUrl(currentPath)) {
    try {
      const absoluteUrl = new URL(relativePath, currentPath)
      return normalizePath(absoluteUrl.href)
    } catch {
      // Fallback for blob URLs or other special cases
      const base = currentPath.substring(0, currentPath.lastIndexOf('/'))
      return `${base}/${relativePath.replace(/^\.\//, '')}`
    }
  }

  // Split paths and remove filename from current path
  const baseParts = currentPath.split('/').slice(0, -1)
  const relativeParts = relativePath.split('/').filter(part => part !== '' && part !== '.')

  // Determine if we're working with a relative base path
  const isRelativeBase = currentPath.startsWith('../') || currentPath.startsWith('./')

  // Build the result path
  const resultParts = [...baseParts]

  for (const part of relativeParts) {
    if (part === '..') {
      if (resultParts.length > 0 && resultParts[resultParts.length - 1] !== '..') {
        // Pop directory if not at a relative boundary
        if (resultParts[resultParts.length - 1] === '.') {
          resultParts[resultParts.length - 1] = '..'
        } else {
          resultParts.pop()
        }
      } else if (isRelativeBase) {
        // Only go up further if we started with a relative path
        resultParts.push('..')
      }
      // Otherwise we're at the root of a non-relative path, so skip
    } else {
      resultParts.push(part)
    }
  }

  // Handle empty result
  if (resultParts.length === 0) {
    return relativeParts[relativeParts.length - 1] || ''
  }

  // Join and clean up
  let result = resultParts.join('/')

  // Remove leading './' only for non-relative results
  if (result.startsWith('./') && !result.includes('../')) {
    result = result.substring(2)
  }

  return result
}

export function isUrl(path: string) {
  return path.startsWith('blob:') || path.startsWith('http:') || path.startsWith('https:')
}
