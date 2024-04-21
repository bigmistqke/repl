type ExportCondition = {
  import?: string | ExportCondition
  default?: string | ExportCondition
  types?: string
  browser?: string | ExportCondition
  node?: string | ExportCondition
  [key: string]: any
}

type ExportEntry = {
  import?: string | ExportCondition
  default?: string | ExportCondition
  types?: string
  node?: string | ExportCondition
  browser?: string | ExportCondition
  development?: string | ExportCondition
  [key: string]: any
}

interface PackageJson {
  main?: string
  name: string
  module?: string
  types?: string
  typings?: string
  exports?: string | ExportEntry
}

export class PackageJsonParser {
  async parse(baseUrl: string) {
    if (baseUrl.startsWith('.')) {
      baseUrl = new URL(baseUrl, window.location.href.toString()).href
    }

    const packageJson = (await fetch(`${baseUrl}package.json`).then(res =>
      res.json(),
    )) as PackageJson

    // Resolve the script path with consideration that `exports` can be a string
    const script =
      typeof packageJson.exports === 'string'
        ? packageJson.exports
        : this.resolveExportPath(baseUrl, packageJson.exports, 'default', 'import') ||
          packageJson.module ||
          packageJson.main
    if (!script) {
      throw new Error('No valid module entry found for script.')
    }

    // Resolve the types path similarly, handling string case
    const types =
      (typeof packageJson.exports !== 'string' &&
        this.resolveExportPath(baseUrl, packageJson.exports, 'default', 'types')) ||
      packageJson.types ||
      packageJson.typings

    return {
      typesUrl: new URL(types, baseUrl).href,
      scriptUrl: new URL(script, baseUrl).href,
      name: packageJson.name,
    }
  }

  private resolveExportPath(
    baseUrl: string,
    exports: ExportEntry | undefined,
    priority: string,
    secondary: string,
  ): string | undefined {
    if (!exports) return undefined

    function getNestedPath(
      entry: ExportEntry | string | undefined,
      key: string,
    ): string | undefined {
      if (!entry) return undefined
      if (typeof entry === 'string') return entry
      return getNestedPath(entry[key], key) || getNestedPath(entry.default, key)
    }

    return (
      getNestedPath(exports[priority], priority) || getNestedPath(exports[secondary], secondary)
    )
  }
}
