import type { Accessor } from 'solid-js'
import { PathUtils } from '../index.ts'
import type { TransformConfig } from '../types.ts'

// Create a new DOMParser and XMLSerializer-instance
const domParser = typeof DOMParser !== 'undefined' ? new DOMParser() : undefined
const xmlSerializer = typeof XMLSerializer !== 'undefined' ? new XMLSerializer() : undefined

export interface TransformHtmlConfig extends TransformConfig {
  transformModule(config: TransformConfig): Accessor<string>
}

export function transformHtml({ path, source, fileUrls, transformModule }: TransformHtmlConfig) {
  if (!domParser || !xmlSerializer) {
    throw `\`parseHtml\` can only be used in environments where DOMParser and XMLSerializer are available. Please use \`parseHtmlWorker\` for a worker-friendly alternative.`
  }
  const doc = domParser.parseFromString(source, 'text/html')

  const updatelinkHref = createUpdateFn<HTMLLinkElement>(doc, 'link[href]', link => {
    const href = link.getAttribute('href')!
    if (PathUtils.isUrl(href)) return
    return () => {
      const url = fileUrls.get(PathUtils.resolvePath(path, href))
      if (url) link.setAttribute('href', url)
    }
  })
  const updateScriptSrc = createUpdateFn<HTMLScriptElement>(doc, 'script[src]', script => {
    const src = script.getAttribute('src')!
    if (PathUtils.isUrl(src)) return
    return () => {
      const url = fileUrls.get(PathUtils.resolvePath(path, src))
      if (url) script.setAttribute('src', url)
    }
  })
  const updateModuleTextContent = createUpdateFn<HTMLLinkElement>(
    doc,
    'script[type="module"]',
    script => {
      const source = script.textContent
      if (script.type !== 'module' || !source) return
      const transformed = transformModule({ path, fileUrls, source })
      return () => (script.textContent = transformed())
    },
  )

  return () => {
    updatelinkHref()
    updateScriptSrc()
    updateModuleTextContent()
    return xmlSerializer.serializeToString(doc)
  }
}

function createUpdateFn<T extends Element>(
  doc: Document,
  selector: string,
  callback: (element: T) => (() => void) | undefined,
) {
  const updateFns = Array.from(doc.querySelectorAll<T>(selector)).map(element => callback(element))
  return () => updateFns.forEach(updateFn => updateFn?.())
}
