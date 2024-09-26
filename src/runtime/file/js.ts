import { Runtime } from '@bigmistqke/repl'
import { createScheduled, debounce } from '@solid-primitives/scheduled'
import { Accessor, batch, createMemo, untrack } from 'solid-js'
import { check, when } from 'src/utils/conditionals'
import { isRelativePath, isUrl, relativeToAbsolutePath } from 'src/utils/path'
import { createEventDispatchEffects, VirtualFile } from './virtual'

class DependencyRemovedEvent extends Event {
  constructor(public file: VirtualFile) {
    super('dependency-removed')
  }
}

/**
 * Represents a JavaScript file within the system. Extends the generic File class.
 */

export class JsFile extends VirtualFile<{ 'dependency-removed': DependencyRemovedEvent }> {
  /** An array of imported `VirtualFiles` found referred to in the source. */
  dependencies: VirtualFile[] = []

  /** Internal callback to get current module-url. */
  #getUrl: Accessor<string | undefined>
  /** Internal callback to get the esm output of the current source. */
  #esm: Accessor<string | undefined>

  constructor(
    public runtime: Runtime,
    public path: string,
  ) {
    super(runtime, path)

    let initialized = false
    const scheduled = createScheduled(fn => debounce(fn, 250))

    // Transpile source to javascript
    const intermediary = when(
      () => (!initialized || scheduled()) && this.source,
      source => {
        initialized = true
        if (source === '') return ''

        if (Array.isArray(runtime.config.transform)) {
          let current = source
          try {
            runtime.config.transform.forEach(transform => {
              current = transform(current, path, runtime)
            })
            return current
          } catch (error) {
            console.error('Error while transforming js', { error, source, current })
            return null
          }
        }

        try {
          return runtime.config.transform(this.source, this.path, runtime)
        } catch (error) {
          console.error('Error while transforming js', { error, source })
        }
      },
    )

    // Transpile intermediary to esm-module:
    // - Transform aliased paths to module-urls
    // - Transform local dependencies to module-urls
    // - Transform package-names to cdn-url
    // NOTE:  possible optimisation would be to memo the holes and swap them out with .slice
    this.#esm = createMemo<string | undefined>(previous =>
      check(
        intermediary,
        intermediary => {
          const imports: VirtualFile[] = []
          const removedImports = new Set(untrack(() => this.dependencies))
          try {
            return batch(() =>
              runtime.config.transformModulePaths(intermediary, modulePath => {
                if (isUrl(modulePath)) return modulePath

                const alias = runtime.fs.alias[modulePath]
                // If the module-path is either an aliased path or a relative path
                if (alias || isRelativePath(modulePath)) {
                  // We resolve the path to a File
                  const file = runtime.fs.resolve(
                    // If path is aliased we resolve the aliased path
                    alias ||
                      // Else the path must be a relative path
                      // So we transform it to an absolute path
                      // and resolve this absolute path
                      relativeToAbsolutePath(path, modulePath),
                  )

                  if (!file) {
                    throw `Could not resolve relative module-path to its virtual file. Are you sure ${modulePath} exists?`
                  }

                  imports.push(file)
                  removedImports.delete(file)

                  return file.moduleTransform()
                }
                // If the module-path is
                //    - not an aliased path,
                //    - nor a relative dependency,
                //    - nor a url
                // It must be a package-name.
                else {
                  // We transform this package-name to a cdn-url.
                  if (runtime.config.importExternalTypes) {
                    runtime.types.import.fromPackageName(modulePath)
                  }
                  return `${runtime.config.cdn}/${modulePath}`
                }
              }),
            )
          } catch (error) {
            console.warn('error', error)
            return previous
          } finally {
            this.dependencies = imports
            for (const removedImport of removedImports) {
              this.dispatchEvent(new DependencyRemovedEvent(removedImport))
            }
          }
        },
        () => previous,
      ),
    )

    // Get latest module-url from esm-module
    this.#getUrl = createMemo(previous => this.createObjectUrl() || previous)

    createEventDispatchEffects(this)
  }

  /**
   * Retrieves the URL of the currently active module.
   * @returns The URL as a string, or undefined if not available.
   */
  get url() {
    return this.#getUrl()
  }

  get type() {
    switch (this.extension) {
      case 'js':
        return 'javascript'
      case 'jsx':
        return 'javascript'
      case 'ts':
        return 'typescript'
      case 'tsx':
        return 'typescript'
      default:
        throw `Unknown extension ${this.extension}`
    }
  }

  /**
   * Resolves and returns all unique dependencies of the file, including both direct and indirect dependencies.
   * This method uses a depth-first search (DFS) approach to traverse and collect all imports.
   *
   * @returns A set of all unique import files.
   */
  resolveDependencies() {
    const set = new Set<VirtualFile>()
    const stack = [...this.dependencies] // Initialize the stack with direct imports

    while (stack.length > 0) {
      const file = stack.pop()
      if (file && !set.has(file)) {
        set.add(file)
        if (file instanceof JsFile) {
          for (const fileImport of file.dependencies) {
            if (!set.has(fileImport)) {
              stack.push(fileImport)
            }
          }
        }
      }
    }

    return Array.from(set)
  }

  createObjectUrl() {
    const url = this.#esm()
    if (url) {
      return URL.createObjectURL(
        new Blob([url], {
          type: 'application/javascript',
        }),
      )
    }
  }

  onDependencyRemoved(callback: (event: DependencyRemovedEvent) => void) {
    this.addEventListener('dependency-removed', callback)
    return () => this.removeEventListener('dependency-removed', callback)
  }
}
