import { createResource } from 'solid-js'
import { PackageJsonParser } from 'src/runtime'
import { whenEffect } from 'src/utils/conditionals'
import { isRelativePath, isUrl, relativeToAbsolutePath } from 'src/utils/path'
import { Runtime } from './runtime'

export class ImportUtils {
  /**
   * Utility to parse package.json files for module management.
   */
  packageJsonParser = new PackageJsonParser()

  constructor(public runtime: Runtime) {}

  /**
   * Imports a package from a specified URL by parsing its package.json and loading its main script and types.
   * This method handles resolving paths, fetching content, and transforming module declarations to maintain compatibility.
   *
   * @param url - The URL to the package.json of the package to import.
   * @returns A promise that resolves when the package has been fully imported.
   * @async
   */
  async fromPackageJson(url: string) {
    const getVirtualPath = (url: string) => (isUrl(url) ? new URL(url).pathname : url)

    const [packageJson] = createResource(() => this.packageJsonParser.parse(url))
    const [project] = createResource(packageJson, async ({ scriptUrl, packageName }) => {
      const project: Record<string, string> = {}
      const resolvePath = async (url: string) => {
        const virtualPath = getVirtualPath(url)

        const code = await fetch(url).then(response => {
          if (response.status !== 200) {
            throw new Error(`Error while loading ${url}: ${response.statusText}`)
          }
          return response.text()
        })

        const promises: Promise<void>[] = []

        const transformedCode = await this.runtime.config.transformModulePaths(code, path => {
          if (isRelativePath(path)) {
            promises.push(resolvePath(relativeToAbsolutePath(url, path)))
          }
          return path
        })

        if (!transformedCode) {
          throw new Error(`Transform returned undefined for ${virtualPath}`)
        }

        await Promise.all(promises)

        project[virtualPath] = transformedCode
      }
      await resolvePath(scriptUrl)

      this.runtime.fs.setAlias(packageName, `node_modules${getVirtualPath(scriptUrl)}`)

      return project
    })

    whenEffect(packageJson, ({ typesUrl, packageName }) => {
      if (typesUrl) this.runtime.types.import.fromUrl(typesUrl, packageName)
    })

    whenEffect(project, project =>
      Object.entries(project).forEach(([path, value]) => {
        this.runtime.fs.create(`node_modules${path}`).set(value)
      }),
    )
  }
}
