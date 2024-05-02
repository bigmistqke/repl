export function relativeToAbsolutePath(currentPath: string, relativePath: string) {
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

export const isUrl = (value: string) =>
  value.startsWith('blob:') || value.startsWith('http:') || value.startsWith('https:')

export const isRelativePath = (value: string) => value.startsWith('.')

// Regex to capture package names including those with or without '@' in the beginning and versions
const regex = /(?:@?[^@\/]*\/)?([^@\/]+)@([^\s\/]+)/
export const pathToPackageNameAndVersion = (path: string) => {
  const match = path.match(regex)
  if (match) {
    const packageName = match[1] // captures the package name, adjusting for optional '@' in the beginning
    const version = match[2] // captures the version
    return [packageName, version] as [string, string]
  } else {
    return undefined
  }
}
