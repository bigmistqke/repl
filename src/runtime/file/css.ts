import { Runtime } from '@bigmistqke/repl'
import { createScheduled, debounce } from '@solid-primitives/scheduled'
import { createEffect } from 'solid-js'
import { JsFile } from './js'
import { VirtualFile } from './virtual'

export function createStyleLoaderSource(path: string, source: string) {
  return `
import { dispose } from "@repl/std"
(() => {
  let stylesheet = document.querySelector('[data-repl-css-id="${path}"]');
  if(!stylesheet){
    stylesheet = document.createElement('style')
    stylesheet.setAttribute('data-repl-css-id', '${path}');
    document.head.appendChild(stylesheet)
    dispose('${path}', () => stylesheet.remove())
  }
  const styles = document.createTextNode(\`${source}\`)
  stylesheet.innerHTML = ''
  stylesheet.appendChild(styles)
})()`
}

/**
 * Represents a CSS file within the system. Extends the generic File class.
 */
export class CssFile extends VirtualFile {
  jsFile: JsFile

  /**
   * Constructs an instance of a CSS module associated with a specific CSS file.
   * @param file The CSS file managed by this module.
   */
  constructor(runtime: Runtime, path: string) {
    super(runtime, path)

    this.jsFile = runtime.fs.create<JsFile>(path.replace('.css', '.js'))

    const scheduled = createScheduled(fn => debounce(fn, 250))

    createEffect(() => {
      if (!scheduled()) return
      this.jsFile.set(createStyleLoaderSource(path, this.get()))
    })
  }

  generate() {
    return this.jsFile.generate()
  }

  /**
   * Retrieves the URL of the currently active CSS esm-module.
   * @returns The URL as a string, or undefined if not available.
   */
  get url() {
    return this.jsFile.generate()
  }
}
