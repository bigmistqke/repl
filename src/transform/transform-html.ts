import type { Transform, TransformConfig } from '../types.ts'
import { isUrl, resolvePath } from '../utils/path.ts'

// Create a new DOMParser and XMLSerializer-instance
const domParser = typeof DOMParser !== 'undefined' ? new DOMParser() : undefined
const xmlSerializer = typeof XMLSerializer !== 'undefined' ? new XMLSerializer() : undefined

export function transformHtml({ path, source, fileUrls }: TransformConfig) {
  if (!domParser || !xmlSerializer) {
    throw `\`parseHtml\` can only be used in environments where DOMParser and XMLSerializer are available. Please use \`parseHtmlWorker\` for a worker-friendly alternative.`
  }
  const doc = domParser.parseFromString(source, 'text/html')
  const api = {
    select<T extends Element>(selector: string, callback: (element: T) => void) {
      Array.from(doc.querySelectorAll<T>(selector)).forEach(callback)
      return api
    },
    /** Bind relative `href`-attribute of all `<link />` elements */
    transformLinkHref() {
      return api.select('link[href]', (link: HTMLLinkElement) => {
        const href = link.getAttribute('href')!
        if (isUrl(href)) return
        const url = fileUrls.get(resolvePath(path, href))
        if (url) link.setAttribute('href', url)
      })
    },
    /** Bind relative `src`-attribute of all `<script />` elements */
    transformScriptSrc() {
      return api.select('script[src]', (script: HTMLScriptElement) => {
        const src = script.getAttribute('src')!
        if (isUrl(src)) return
        const url = fileUrls.get(resolvePath(path, script.getAttribute('src')!))
        if (url) script.setAttribute('src', url)
      })
    },
    /** Transform content of all `<script type="module" />` elements */
    transformModuleScriptContent(transformJs: Transform) {
      return api.select('script[type="module"]', (script: HTMLScriptElement) => {
        if (script.type !== 'module' || !script.textContent) return
        script.textContent = transformJs({
          path,
          source: script.textContent,
          fileUrls: fileUrls,
        })
      })
    },
    toString() {
      return xmlSerializer.serializeToString(doc)
    },
  }
  return api
}
