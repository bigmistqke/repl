import { createStyleLoaderSource, JsFile, Runtime, VirtualFile } from '@bigmistqke/repl'
import { createEffect } from 'solid-js'
import zeptoid from 'zeptoid'

/**
 * Represents a CSS module file that transforms CSS class names and generates a corresponding JavaScript file to inject the stylesheet.
 * The JavaScript file exports an object mapping original class names to transformed class names, similar to how CSS modules work.
 *
 * @example
 * ```tsx
 * import { CssModuleFile } from "@bigmistqke/repl/file-extra/css-module"
 * const repl = <Repl extensions={{ "module.css": CssModuleFile }} />
 * ```
 */
export class CssModuleFile extends VirtualFile {
  jsFile: JsFile

  type = 'css'

  constructor(runtime: Runtime, path: string) {
    super(runtime, path)
    this.jsFile = runtime.fs.create(`${path}.ts`)

    createEffect(() => {
      const aliases = {} as Record<string, string>
      const transformed = transformCssClasses(this.get(), className => {
        const newClassName = `${className}___REPL___${zeptoid()}`
        aliases[className] = newClassName
        return newClassName
      })
      this.jsFile.set(`${createStyleLoaderSource(path, transformed)}
export default ${JSON.stringify(aliases)} as const
        `)
    })
  }

  createObjectUrl(): string | undefined {
    return this.jsFile.createObjectUrl()
  }

  get url() {
    return this.jsFile.url
  }

  moduleTransform() {
    const url = this.createObjectUrl()
    if (!url) throw `Module not loaded`
    return url
  }
}

/**
 * Transforms CSS class names in a source string using a callback function.
 * @param {string} source - The source string containing CSS.
 * @param {function(string): string} callback - The callback function to transform class names.
 * @returns {string} The transformed CSS string.
 */
export function transformCssClasses(
  source: string,
  callback: (className: string) => string,
): string {
  const classPattern = /\.([a-zA-Z_][\w-]*)\b/g
  const ranges: Record<string, [number, number][]> = {}

  // Step 1: Collect all classes and their ranges
  {
    // Get cleaned version of source
    const cleanedSource = source
      // Replace CSS comments with whitespace
      .replace(/\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g, match => ' '.repeat(match.length))
      // Replace single and double-quoted strings with whitespace
      .replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, match => ' '.repeat(match.length))

    // Get the ranges of the classes
    let match: RegExpExecArray | null
    while ((match = classPattern.exec(cleanedSource)) !== null) {
      const className = match[1]
      if (!className) continue
      if (!ranges[className]) {
        ranges[className] = []
      }
      ranges[className]!.push([match.index + 1, match.index + 1 + className.length])
    }
  }

  // Step 2: Replace old class names with new class names using the ranges
  const newCssParts = []
  let lastIndex = 0

  {
    for (const className in ranges) {
      const newClassName = callback(className)
      for (const [start, end] of ranges[className]!) {
        newCssParts.push(source.slice(lastIndex, start))
        newCssParts.push(newClassName)
        lastIndex = end
      }
    }
    newCssParts.push(source.slice(lastIndex))
  }

  return newCssParts.join('')
}
