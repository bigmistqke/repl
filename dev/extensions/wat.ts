import { createResource } from 'solid-js'
import { Runtime, VirtualFile, WasmFile } from 'src/create-filesystem'
import { every, whenEffect } from 'src/utils/conditionals'
import WABT from 'wabt'

const [wabt] = createResource(() => WABT())

/**
 * Represents a WebAssembly Text (WAT) file that compiles to a corresponding WebAssembly (WASM) file.
 * The WASM file content is set in Base64 encoding.
 *
 * @example
 * ```tsx
 * import { WatFile } from "@bigmistqke/repl/file-extra/wat"
 * const repl = <Repl extensions={{ "wat": WatFile }} />
 * ```
 */
export class WatFile extends VirtualFile {
  private wasmFile: WasmFile

  type = 'wat'

  constructor(runtime: Runtime, path: string) {
    super(runtime, path)

    this.wasmFile = new WasmFile(runtime, path.replace('.wat', '.wasm'), false)
    const [wasm] = createResource(every(this.get.bind(this), wabt), ([source, wabt]) =>
      wabt.parseWat(path, source),
    )

    whenEffect(wasm, wasm => {
      const { buffer } = wasm.toBinary({})
      const base64String = btoa(String.fromCharCode(...new Uint8Array(buffer)))
      this.wasmFile.set(base64String)
    })
  }

  createObjectUrl() {
    return this.wasmFile.createObjectUrl()
  }

  get url() {
    return this.wasmFile.url // Use the URL from WasmFile
  }
}
