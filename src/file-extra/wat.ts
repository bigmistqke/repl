import { createEffect, createResource } from 'solid-js'
import { every, whenever } from 'src/utils/conditionals'
import WABT from 'wabt'
import { AbstractFile } from '../runtime/file/virtual'
import { WasmFile } from '../runtime/file/wasm'
import { Runtime } from '../runtime/runtime'

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
export class WatFile extends AbstractFile {
  private wasmFile: WasmFile

  constructor(runtime: Runtime, path: string) {
    super(runtime, path)

    this.wasmFile = new WasmFile(runtime, path.replace('.wat', '.wasm'), false)
    const [wasm] = createResource(every(this.get.bind(this), wabt), ([source, wabt]) =>
      wabt.parseWat(path, source),
    )

    createEffect(
      whenever(wasm, wasm => {
        const { buffer } = wasm.toBinary({})
        const base64String = btoa(String.fromCharCode(...new Uint8Array(buffer)))
        this.wasmFile.set(base64String)
      }),
    )
  }

  generate() {
    return this.wasmFile.generate()
  }

  get url() {
    return this.wasmFile.url // Use the URL from WasmFile
  }
}
