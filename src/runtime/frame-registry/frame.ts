import { JsFile, VirtualFile } from '@bigmistqke/repl'
import { createEffect, on, onCleanup } from 'solid-js'
import { when } from 'src/utils/conditionals'

/**
 * Represents an individual `<iframe/>` within the application.
 * It offers method to inject and execute Javascript and CSS code into its `Window`.
 *
 * @class FrameApi
 */
export class Frame {
  constructor(
    /** The window object associated with this frame, typically an iframe's window. */
    public contentWindow: Window,
  ) {}

  injectModuleUrl(moduleUrl: string) {
    const script = this.contentWindow.document.createElement('script')
    script.type = 'module'
    script.src = moduleUrl
    this.contentWindow.document.head.appendChild(script)

    return () => {
      // On cleanup we remove the script-tag
      this.contentWindow.document.head.removeChild(script)
      // And we dispose of the created module-url.
      URL.revokeObjectURL(moduleUrl)
    }
  }

  /**
   * Injects and executes the esm-module of the given `VirtualFile` into the frame's window.
   * Returns the injected script-element.
   *
   * @param entry - The file to inject, which could be a `VirtualFile`.
   * @returns The script element that was injected.
   */
  injectFile(entry: VirtualFile) {
    // Dispose
    createEffect(
      on(
        () => entry.url,
        () => onCleanup(() => this.dispose(entry.path)),
      ),
    )
    if (entry instanceof JsFile) {
      entry.onDependencyRemoved(file => this.dispose(file.path))
    }
    // We need to generate a new module-url everytime we inject a file, to ensure the body is executed.
    return when(entry.generate(), url => {
      return this.injectModuleUrl(url)
    })
  }

  /**
   * Runs `this.contentWindow.repl.dispose()` if it is defined.
   * To make use of the disposal mechanism, pass your cleanup-functions to `dispose` of the repl-standard library.
   *
   * @example in repl-code:
   * ```tsx
   * import { dispose } from "@repl/std"
   * import { render } from "solid-js/web"
   *
   * // This will remove the render-artefacts everytime frame.dispose() is called.
   * dispose(render(() => <>{new Date().now()}</>))
   * ```
   */
  dispose(id?: string) {
    const disposeFn = this.contentWindow.repl?.dispose
    if (typeof disposeFn === 'function') {
      return disposeFn(id)
    }
  }

  reload() {
    this.contentWindow.location.reload()
  }

  clearBody() {
    this.contentWindow.document.body.innerHTML = ''
  }
}
