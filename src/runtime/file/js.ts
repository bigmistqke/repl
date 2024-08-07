import { createScheduled, debounce } from '@solid-primitives/scheduled'
import {
  Accessor,
  Setter,
  batch,
  createMemo,
  createResource,
  createSignal,
  untrack,
} from 'solid-js'
import { when } from 'src/utils/conditionals'
import { isRelativePath, isUrl, relativeToAbsolutePath } from 'src/utils/path'
import { Runtime } from '../runtime'
import { AbstractFile } from './virtual'

/**
 * Represents a JavaScript file within the system. Extends the generic File class.
 */
export class JsFile extends AbstractFile {
  /** An array of imported `VirtualFiles` found referred to in the source. */
  directDependencies: Accessor<AbstractFile[]>
  /** Internal setter for the imported `VirtualFiles`. */
  #setDirectDependencies: Setter<AbstractFile[]>
  /** Internal callback to get current module-url. */
  #getUrl: Accessor<string | undefined>
  /** Internal callback to get the esm output of the current source. */
  #esm: Accessor<string | undefined>

  constructor(
    public runtime: Runtime,
    public path: string,
  ) {
    super(runtime, path)
    ;[this.directDependencies, this.#setDirectDependencies] = createSignal<AbstractFile[]>([])

    let initialized = false
    const scheduled = createScheduled(fn => debounce(fn, 250))

    // Transpile source to javascript
    const [intermediary] = createResource(
      () => [this.get(), !initialized || scheduled()] as const,
      async ([source]) => {
        initialized = true
        try {
          if (Array.isArray(runtime.config.transform)) {
            return runtime.config.transform.reduce(
              (source, transform) => transform(source, path),
              source,
            )
          }
          return runtime.config.transform(this.get(), this.path)
        } catch (error) {
          console.error('error while transforming js', error)
        }
      },
    )

    // Transpile intermediary to esm-module:
    // - Transform aliased paths to module-urls
    // - Transform local dependencies to module-urls
    // - Transform package-names to cdn-url
    // NOTE:  possible optimisation would be to memo the holes and swap them out with .slice
    this.#esm = createMemo<string | undefined>(previous =>
      when(
        intermediary,
        value => {
          const imports: AbstractFile[] = []
          const staleImports = new Set(untrack(this.directDependencies))
          try {
            return batch(() =>
              runtime.config.transformModulePaths(value, modulePath => {
                if (isUrl(modulePath)) return modulePath

                const alias = runtime.fileSystem.alias[modulePath]
                // If the module-path is either an aliased path or a relative path
                if (alias || isRelativePath(modulePath)) {
                  // We resolve the path to a File
                  const file = runtime.fileSystem.resolve(
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
                  staleImports.delete(file)

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
                    runtime.typeRegistry.import.fromPackageName(modulePath)
                  }
                  return `${runtime.config.cdn}/${modulePath}`
                }
              }),
            )
          } catch (error) {
            console.warn('error', error)
            return previous
          } finally {
            this.#setDirectDependencies(imports)
          }
        },
        () => previous,
      ),
    )

    // Get latest module-url from esm-module
    this.#getUrl = createMemo(previous =>
      when(
        this.generate.bind(this),
        esm => esm,
        () => previous,
      ),
    )
  }

  /**
   * Resolves and returns all unique dependencies of the file, including both direct and indirect dependencies.
   * This method uses a depth-first search (DFS) approach to traverse and collect all imports.
   *
   * @returns A set of all unique import files.
   */
  resolveDependencies() {
    const set = new Set<AbstractFile>()
    const stack = [...this.directDependencies()] // Initialize the stack with direct imports

    while (stack.length > 0) {
      const file = stack.pop()
      if (file && !set.has(file)) {
        set.add(file)
        if (file instanceof JsFile) {
          for (const fileImport of file.directDependencies()) {
            if (!set.has(fileImport)) {
              stack.push(fileImport)
            }
          }
        }
      }
    }

    return Array.from(set)
  }

  generate() {
    return when(this.#esm.bind(this), esm =>
      URL.createObjectURL(
        new Blob([esm], {
          type: 'application/javascript',
        }),
      ),
    )
  }

  /**
   * Retrieves the URL of the currently active module.
   * @returns The URL as a string, or undefined if not available.
   */
  get url() {
    return this.#getUrl()
  }
}
