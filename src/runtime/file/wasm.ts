import { Runtime } from '@bigmistqke/repl'
import { createScheduled, debounce } from '@solid-primitives/scheduled'
import { Accessor, createMemo } from 'solid-js'
import { whenEffect } from 'src/utils/conditionals'
import { javascript } from 'src/utils/object-url-literal'
import { createEventDispatchEffects, UrlEvent, VirtualFile } from './virtual'

export class WasmFile extends VirtualFile {
  #getUrl: Accessor<string | undefined>
  createObjectUrl: Accessor<string | undefined>

  type = 'wasm'

  /**
   * Constructs an instance of a WASM module associated with a specific WASM file.
   * @param path - The path to the WASM file within the virtual file system.
   */
  constructor(runtime: Runtime, path: string, controlled?: boolean) {
    super(runtime, path, controlled)

    const scheduled = createScheduled(fn => debounce(fn, 250))

    // Create a JavaScript module that instantiates the WASM module
    this.createObjectUrl = () => {
      const wasmBinaryString = this.get()
      if (!wasmBinaryString) return undefined
      // Convert the binary string to a binary format
      const binaryBuffer = Uint8Array.from(atob(wasmBinaryString), c => c.charCodeAt(0))
      // Inline binary buffer into script
      return javascript`
const wasmCode = new Uint8Array([${binaryBuffer.toString()}]);
export default (imports) =>  WebAssembly.instantiate(wasmCode, imports).then(result => result.instance);
`
    }

    // Create a Blob URL for the JS wrapper
    // return URL.createObjectURL(new Blob([jsWrapper], { type: 'application/javascript' }))
    this.#getUrl = createMemo(previous => {
      if (!scheduled()) {
        return previous
      }
      const url = this.createObjectUrl()
      if (!url) {
        return previous
      }
      this.dispatchEvent(new UrlEvent(url))
      return url
    })

    createEventDispatchEffects(this)
  }

  /**
   * Retrieves the URL of the currently active JavaScript wrapper module.
   * @returns The URL as a string, or undefined if not available.
   */
  get url() {
    return this.#getUrl()
  }
}

export class WasmTarget extends VirtualFile {
  private wasmFile: WasmFile

  type = 'wasm'

  constructor(runtime: Runtime, path: string, wasm: (source: string) => string | undefined) {
    super(runtime, path)
    this.wasmFile = new WasmFile(runtime, path.replace('.wat', '.wasm'))
    whenEffect(
      () => wasm(this.get()),
      wasm => this.wasmFile.set(wasm),
    )
    createEventDispatchEffects(this)
  }

  createObjectUrl() {
    return this.wasmFile.createObjectUrl()
  }

  get url() {
    return this.wasmFile.url // Use the URL from WasmFile
  }
}
