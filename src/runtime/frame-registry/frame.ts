import { onCleanup } from 'solid-js'
import { when } from 'src/utils/conditionals'
import { CssFile, JsFile } from '../file-system/file'

/**
 * Represents an individual `<iframe/>` within the application.
 * It offers method to inject and execute Javascript and CSS code into its `Window`.
 *
 * @class Frame
 */
export class Frame {
  /**
   * Constructs a Frame instance associated with a given window.
   *
   * @param contentWindow - The window object associated with this frame.
   */
  constructor(
    /** The window object associated with this frame, typically an iframe's window. */
    public contentWindow: Window,
  ) {}

  injectModuleUrl(moduleUrl: string) {
    const script = this.contentWindow.document.createElement('script')
    script.type = 'module'
    script.src = moduleUrl
    this.contentWindow.document.head.appendChild(script)
    onCleanup(() => {
      // On cleanup we remove the script-tag
      this.contentWindow.document.head.removeChild(script)
      // And we dispose of the created module-url.
      URL.revokeObjectURL(moduleUrl)
    })
    return script
  }

  /**
   * Injects and executes the esm-module of the given `CssFile` or `JsFile` into the frame's window.
   * Returns the injected script-element.
   *
   * @param file - The file to inject, which could be a `CssFile` or `JsFile`.
   * @returns The script element that was injected.
   */
  injectFile(file: CssFile | JsFile) {
    // We need to generate a new module-url everytime we inject a file, to ensure the body is executed.
    return when(file.generate(), url => this.injectModuleUrl(url))
  }

  dispose(file: CssFile | JsFile) {
    return file.dispose(this)
  }
}
