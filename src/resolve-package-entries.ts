type PackageJson = {
  main?: string
  module?: string
  browser?: string | Record<string, string>
  exports?: ExportsField
}

type ExportsField = string | ExportsConditions | ExportsField[]

type ExportsConditions = {
  '.'?: ExportsField
  browser?: ExportsField
  import?: ExportsField
  require?: ExportsField
  default?: ExportsField
  [key: string]: ExportsField | undefined
}

type ResolveConditions = {
  browser?: boolean
  require?: boolean
  import?: boolean
}

type ResolvedPaths = {
  [key: string]: string
}

function resolveExports(exports: ExportsField, conditions: ResolveConditions): string | null {
  if (typeof exports === 'string') {
    return exports
  }

  if (Array.isArray(exports)) {
    for (const exp of exports) {
      const resolved = resolveExports(exp, conditions)
      if (resolved) return resolved
    }
    return null
  }

  if (typeof exports === 'object') {
    // Handle conditional exports
    if (conditions.browser && exports.browser) {
      return resolveExports(exports.browser, conditions)
    }

    if (conditions.import && exports.import) {
      return resolveExports(exports.import, conditions)
    }

    if (conditions.require && exports.require) {
      return resolveExports(exports.require, conditions)
    }

    // Handle default export
    if (exports.default) {
      return resolveExports(exports.default, conditions)
    }
  }

  return null
}

function resolveMainEntry(
  pkg: PackageJson,
  conditions: ResolveConditions = { browser: true, require: true, import: true },
): string {
  // Try exports field first (highest precedence)
  if (pkg.exports) {
    if (typeof pkg.exports === 'string' || Array.isArray(pkg.exports)) {
      const resolved = resolveExports(pkg.exports, conditions)
      if (resolved) return resolved
    } else if (pkg.exports['.']) {
      const resolved = resolveExports(pkg.exports['.'], conditions)
      if (resolved) return resolved
    }
  }

  // Try browser field
  if (conditions.browser && pkg.browser) {
    if (typeof pkg.browser === 'string') {
      return pkg.browser
    }
    // Handle browser field object mapping
    if (typeof pkg.browser === 'object') {
      const mainFile = pkg.module || pkg.main || './index.js'
      return pkg.browser[mainFile] || mainFile
    }
  }

  // Try module field (ES modules)
  if (conditions.import && pkg.module) {
    return pkg.module
  }

  // Fallback to main field
  if (conditions.require && pkg.main) {
    return pkg.main
  }

  // Default fallback
  return './index.js'
}

export function resolvePackageEntries(
  pkg: PackageJson,
  conditions: ResolveConditions = { browser: true, require: true, import: true },
): ResolvedPaths {
  const resolved: ResolvedPaths = {
    '.': resolveMainEntry(pkg, conditions),
  }

  // Handle exports field subpaths
  if (pkg.exports && typeof pkg.exports === 'object' && !Array.isArray(pkg.exports)) {
    for (const [key, value] of Object.entries(pkg.exports)) {
      if (key !== '.' && value !== undefined) {
        const resolvedPath = resolveExports(value, conditions)
        if (resolvedPath) {
          resolved[key] = resolvedPath
        }
      }
    }
  }

  // Handle browser field mappings
  if (conditions.browser && typeof pkg.browser === 'object') {
    for (const [key, value] of Object.entries(pkg.browser)) {
      if (key !== '.' && key !== pkg.main && key !== pkg.module) {
        resolved[key] = value
      }
    }
  }

  return resolved
}
