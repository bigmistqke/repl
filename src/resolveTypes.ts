class FS {
  filesystem: Record<string, string> = {}

  updateFile(path: string, value: string) {
    this.filesystem[path] = value
  }

  checkIfPathExists(path: string) {
    return !!this.filesystem[path]
  }
  relativeToAbsolutePath(currentPath: string, relativePath: string) {
    const count = relativePath.match(/\.\.\//g)?.length || 0
    const newPath = [
      ...currentPath.split('/').slice(0, -(count + 1)),
      ...relativePath.split('/').slice(1),
    ].join('/')
    return newPath
  }
}

const importRegex =
  /import(?:\s+type)?\s+(?:\* as \s+\w+|\w+\s*,)?(?:\{[^}]*\}\s*)?from\s*"(.+?)";?/gs

const exportRegex = /export\s+(?:\* from|type\s+\{[^}]*\}\s*from|\{[^}]*\}\s*from)\s*"(.+?)";?/gs

export const resolveTypes = async (url: string) => {
  const typeUrl = await fetch(`https://esm.sh/${url}`).then(result =>
    result.headers.get('X-TypeScript-Types'),
  )
  const base = typeUrl!.split('/').slice(0, -1).join('/')
  const entry = typeUrl!.split('/').slice(-1)[0]!
  const fs = new FS()

  const resolvePath = async (path: string) => {
    if (fs.checkIfPathExists(path)) return
    await fetch(`${base}/${path}`)
      .then(value => value.text())
      .then(text => {
        fs.updateFile(path, text)

        const matches = [...text.matchAll(importRegex), ...text.matchAll(exportRegex)]

        return Promise.all(
          matches.map(([_, relativePath]) => {
            if (relativePath && relativePath.startsWith('.')) {
              const newPath = fs.relativeToAbsolutePath(path, relativePath)
              if (fs.checkIfPathExists(newPath)) {
                return
              }
              return resolvePath(newPath)
            }
          }),
        )
      })
  }

  await resolvePath(entry)
  return { fs, entry }
}
