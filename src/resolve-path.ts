export function resolvePath(currentPath: string, relativePath: string) {
  return new URL(relativePath, new URL(currentPath, 'http://example.com/')).pathname
}
