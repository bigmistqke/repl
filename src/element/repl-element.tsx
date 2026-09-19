import { render } from '@solidjs/web'
import { createSignal } from 'solid-js'
import type { Extension } from '../types.ts'
import { Repl, type ReplRef } from './repl.tsx'

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
 * `extensions` and `ref` must be set before the element connects (both are
 * only read once, on `connectedCallback`); `files` can be set before or
 * after and is fully reactive.
 *
 * This is just `<Repl/>` mounted into the custom element with `render` — the
 * iframe/compile pipeline itself lives in `<Repl/>`, not here.
 *
 * This is a base primitive, not a full editor UI. An editor pane, if any, is
 * the host's concern; wire it up by setting `.files` again on change.
 */
export class ReplElement extends HTMLElement {
  #dispose?: () => void
  #setFiles?: (files: ReplElementFiles) => void
  #pendingFiles?: ReplElementFiles
  #extensions?: Record<string, Extension>
  #ref?: (api: ReplRef) => void

  set files(value: ReplElementFiles) {
    if (this.#setFiles) {
      this.#setFiles(value)
    } else {
      // connectedCallback hasn't run yet; stash it for then.
      this.#pendingFiles = value
    }
  }

  set extensions(value: Record<string, Extension>) {
    if (this.#dispose) {
      throw new Error('ReplElement: `extensions` must be set before the element connects.')
    }
    this.#extensions = value
  }

  set ref(value: (api: ReplRef) => void) {
    if (this.#dispose) {
      throw new Error('ReplElement: `ref` must be set before the element connects.')
    }
    this.#ref = value
  }

  connectedCallback() {
    if (!this.#extensions) {
      throw new Error('ReplElement: `extensions` must be set before the element connects.')
    }

    this.style.display ||= 'block'

    const [config, setConfig] = createSignal<ReplElementFiles>(
      this.#pendingFiles ?? { files: {}, entry: '/index.html' },
    )
    this.#setFiles = setConfig
    this.#pendingFiles = undefined

    this.#dispose = render(
      () => (
        <Repl
          extensions={this.#extensions!}
          readFile={path => config().files[path]}
          entry={config().entry}
          style={{ width: '100%', height: '100%', border: '0', display: 'block' }}
          sandbox="allow-scripts allow-same-origin"
          ref={this.#ref}
        />
      ),
      this,
    )
  }

  disconnectedCallback() {
    this.#dispose?.()
    this.#dispose = undefined
    this.#setFiles = undefined
  }
}
