import { createEffect, createMemo, createRoot, createSignal, latest } from 'solid-js'
import { createFileUrlSystem } from '../core/create-file-url-system.ts'
import type { Extension } from '../types.ts'

export interface ReplElementFiles {
  /** Path -> source, e.g. `{ "/index.html": "...", "/src/main.ts": "..." }`. */
  files: Record<string, string>
  /** Path of the file to load into the iframe. Defaults to `/index.html`. */
  entry?: string
}

/**
 * `<repl-element>` — a framework-agnostic, sandboxed iframe runner for a set
 * of virtual files.
 *
 * Deliberately carries no opinion about what a file extension means: the
 * host page supplies `extensions` (the same `Extension` map `repl`'s core
 * takes), so whether `.ts`/`.tsx` get compiled at all, and with what, is
 * entirely up to the consumer — an app with no TypeScript files can leave
 * `extensions` at `{}` plus whatever it needs (e.g. `html`/`css`).
 *
 * `extensions` must be set before the element connects (it defines the
 * reactive file-url system once, on `connectedCallback`); `files` can be
 * set before or after and is fully reactive.
 *
 * This is a base primitive, not a full editor UI — it owns the iframe and
 * the compile/url pipeline only. An editor pane, if any, is the host's
 * concern; wire it up by setting `.files` again on change.
 */
export class ReplElement extends HTMLElement {
  #disposeRoot?: () => void
  #setFiles?: (files: ReplElementFiles) => void
  #pendingFiles?: ReplElementFiles
  #extensions?: Record<string, Extension>

  set files(value: ReplElementFiles) {
    if (this.#setFiles) {
      this.#setFiles(value)
    } else {
      // connectedCallback hasn't run yet; stash it for then.
      this.#pendingFiles = value
    }
  }

  set extensions(value: Record<string, Extension>) {
    if (this.#disposeRoot) {
      throw new Error('ReplElement: `extensions` must be set before the element connects.')
    }
    this.#extensions = value
  }

  connectedCallback() {
    if (!this.#extensions) {
      throw new Error('ReplElement: `extensions` must be set before the element connects.')
    }

    this.style.display ||= 'block'

    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'width:100%;height:100%;border:0;display:block;'
    iframe.sandbox.add('allow-scripts', 'allow-same-origin')
    this.appendChild(iframe)

    this.#disposeRoot = createRoot(dispose => {
      const [config, setConfig] = createSignal<ReplElementFiles>(
        this.#pendingFiles ?? { files: {}, entry: '/index.html' },
      )
      this.#setFiles = setConfig
      this.#pendingFiles = undefined

      const fileUrls = createFileUrlSystem({
        readFile: path => config().files[path],
        extensions: this.#extensions!,
      })

      const entryUrl = createMemo(() => latest(() => fileUrls.get(config().entry ?? '/index.html')))

      createEffect(entryUrl, url => {
        iframe.src = url ?? 'about:blank'
      })

      return dispose
    })
  }

  disconnectedCallback() {
    this.#disposeRoot?.()
    this.#disposeRoot = undefined
    this.#setFiles = undefined
  }
}
