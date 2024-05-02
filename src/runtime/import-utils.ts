import { createEffect, createResource } from 'solid-js'
import { PackageJsonParser } from 'src/runtime'
import { whenever } from 'src/utils/conditionals'
import { isRelativePath, isUrl, relativeToAbsolutePath } from 'src/utils/path'
import ts from 'typescript'
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

        const transformedCode = this.runtime.transpiler.transformModuleDeclarations(code, node => {
          const specifier = node.moduleSpecifier as ts.StringLiteral
          const path = specifier.text
          if (isRelativePath(path)) {
            promises.push(resolvePath(relativeToAbsolutePath(url, path)))
          }
        })

        if (!transformedCode) {
          throw new Error(`Transform returned undefined for ${virtualPath}`)
        }

        await Promise.all(promises)

        project[virtualPath] = transformedCode
      }
      await resolvePath(scriptUrl)

      this.runtime.fileSystem.setAlias(packageName, `node_modules${getVirtualPath(scriptUrl)}`)

      return project
    })

    createEffect(
      whenever(packageJson, ({ typesUrl, packageName }) => {
        if (typesUrl) this.runtime.typeRegistry.import.fromUrl(typesUrl, packageName)
      }),
    )

    createEffect(
      whenever(project, project =>
        Object.entries(project).forEach(([path, value]) => {
          this.runtime.fileSystem.create(`node_modules${path}`).set(value)
        }),
      ),
    )
  }
}
