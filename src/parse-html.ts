import { FileSystem, Transform } from './create-filesystem'
import { isUrl, resolvePath } from './path'

// Create a new DOMParser and XMLSerializer-instance
const domParser = new DOMParser()
const xmlSerializer = new XMLSerializer()

export function parseHtml({ path, source, fs }: { path: string; source: string; fs: FileSystem }) {
  const doc = domParser.parseFromString(source, 'text/html')
  const api = {
    select<T extends Element>(selector: string, callback: (element: T) => void) {
      Array.from(doc.querySelectorAll<T>(selector)).forEach(callback)
      return api
    },
    /** Bind relative `href`-attribute of all `<link />` elements */
    bindLinkHref() {
      return api.select('link[href]', (link: HTMLLinkElement) => {
        const href = link.getAttribute('href')!
        if (isUrl(href)) return
        const url = fs.url(resolvePath(path, href))
        if (url) link.setAttribute('href', url)
      })
    },
    /** Bind relative `src`-attribute of all `<script />` elements */
    bindScriptSrc() {
      return api.select('script[src]', (script: HTMLScriptElement) => {
        const src = script.getAttribute('src')!
        if (isUrl(src)) return
        const url = fs.url(resolvePath(path, script.getAttribute('src')!))
        if (url) script.setAttribute('src', url)
      })
    },
    /** Transform content of all `<script type="module" />` elements */
    transformModuleScriptContent(transformJs: Transform) {
      return api.select('script[type="module"]', (script: HTMLScriptElement) => {
        if (script.type !== 'module' || !script.textContent) return
        script.textContent = transformJs({ path, source: script.textContent, fs })
      })
    },
    toString() {
      return xmlSerializer.serializeToString(doc)
    },
  }
  return api
}
