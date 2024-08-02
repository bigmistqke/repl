interface ExportCondition {
  /** The import path for the module. */
  import?: string | ExportCondition
  /** The default export path for the module. */
  default?: string | ExportCondition
  /** The types definition path for the module. */
  types?: string
  /** The browser-specific export path. */
  browser?: string | ExportCondition
  /** The Node.js-specific export path. */
  node?: string | ExportCondition
  /** Additional custom properties. */
  [key: string]: any
}

interface ExportEntry {
  /** The import path for the module. */
  import?: string | ExportCondition
  /** The default export path for the module. */
  default?: string | ExportCondition
  /** The types definition path for the module. */
  types?: string
  /** The Node.js-specific export path. */
  node?: string | ExportCondition
  /** The browser-specific export path. */
  browser?: string | ExportCondition
  /** The development-specific export path. */
  development?: string | ExportCondition
  /** Additional custom properties. */
  [key: string]: any
}

interface PackageJson {
  /** The main entry point of the package. */
  main?: string
  /** The name of the package. */
  name: string
  /** The module entry point for ES modules. */
  module?: string
  /** The types definition path for the package. */
  types?: string
  /** Alias for the types definition path. */
  typings?: string
  /** The exports field for the package. */
  exports?: string | ExportEntry
}

/** Parses the package.json file from a given base URL. */
export class PackageJsonParser {
  /**
   * Fetches and parses the package.json file.
   * @param baseUrl - The base URL to fetch the package.json from.
   * @returns An object containing the script URL, types URL, and package name.
   * @throws Will throw an error if no valid module entry is found.
   */
  async parse(baseUrl: string) {
    if (baseUrl.startsWith('.')) {
      baseUrl = new URL(baseUrl, window.location.href.toString()).href
    }

    const packageJson = (await fetch(`${baseUrl}/package.json`).then(res =>
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
      typesUrl: types && new URL(types, `${baseUrl}/`).href,
      scriptUrl: new URL(script, `${baseUrl}/`).href,
      packageName: packageJson.name,
    }
  }

  /**
   * Resolves the export path for a given entry in the package exports.
   * @param baseUrl - The base URL for resolving paths.
   * @param exports - The exports entry to resolve.
   * @param priority - The primary export key to resolve.
   * @param secondary - The secondary export key to resolve.
   * @returns The resolved export path or undefined if not found.
   */
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
