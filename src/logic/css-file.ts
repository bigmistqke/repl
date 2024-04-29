import { createScheduled, throttle } from '@solid-primitives/scheduled'
import { Accessor, createMemo, createSignal } from 'solid-js'
import { createLog } from '..'
import { File, Model } from './file'
import { FileSystem } from './file-system'

const log = createLog('css-file', true)

let counter = 0
export class CssFile extends File {
  private source: Accessor<string | undefined>
  model: Model
  moduleUrl: Accessor<string | undefined>
  id: number | undefined

  constructor(fs: FileSystem, path: string) {
    super()
    const uri = fs.monaco.Uri.parse(`file:///${path.replace('./', '')}`)
    this.model = fs.monaco.editor.getModel(uri) || fs.monaco.editor.createModel('', 'css', uri)

    const [source, setSource] = createSignal<string | undefined>()
    this.source = source

    const scheduled = createScheduled(fn => throttle(fn, 1000))

    this.moduleUrl = createMemo(previous => {
      if (!scheduled) previous
      const source = `(() => {
        let stylesheet = document.getElementById('${path}');
        if (!stylesheet) {
          stylesheet = document.createElement('style')
          stylesheet.setAttribute('id', '${path}')
          document.head.appendChild(stylesheet)
        }
        const styles = document.createTextNode(\`${this.source()}\`)
        stylesheet.innerHTML = ''
        stylesheet.appendChild(styles)
      })()`

      const url = URL.createObjectURL(new Blob([source], { type: 'application/javascript' }))
      return url
    })
    // Subscribe to onDidChangeContent of this.model
    this.model.onDidChangeContent(() => {
      log('changed', this.model.getValue())
      setSource(this.model.getValue())
    })
  }

  toJSON() {
    return this.source()
  }

  set(value: string) {
    log('set', value)
    this.model.setValue(value)
  }

  get() {
    this.source()
    return this.model.getValue()
  }
}
