import serialize from 'dom-serializer'
import { findAll, getAttributeValue, hasAttrib } from 'domutils'
import { parseDocument } from 'htmlparser2'
import { isUrl, resolvePath } from './path.ts'
import { Transform, TransformConfig } from './types.ts'

export function parseHtmlWorker({ path, source, executables }: TransformConfig) {
  const doc = parseDocument(source)

  const api = {
    select(selector: string, callback: (element: any) => void) {
      findAll(
        elem => !!(elem.tagName && elem.tagName.toLowerCase() === selector.toLowerCase()),
        doc.children,
      ).forEach(callback)
      return api
    },
    /** Bind relative `href`-attribute of all `<link />` elements */
    bindLinkHref() {
      return api.select('link', (link: any) => {
        if (hasAttrib(link, 'href')) {
          const href = getAttributeValue(link, 'href')
          if (!href || isUrl(href)) return
          const url = executables.get(resolvePath(path, href))
          if (url) link.attribs.href = url
        }
      })
    },
    /** Bind relative `src`-attribute of all `<script />` elements */
    bindScriptSrc() {
      return api.select('script', (script: any) => {
        if (hasAttrib(script, 'src')) {
          const src = getAttributeValue(script, 'src')
          if (!src || isUrl(src)) return
          const url = executables.get(resolvePath(path, src))
          if (url) script.attribs.src = url
        }
      })
    },
    /** Transform content of all `<script type="module" />` elements */
    transformModuleScriptContent(transformJs: Transform) {
      return api.select('script', (script: any) => {
        if (getAttributeValue(script, 'type') === 'module' && script.children.length) {
          const scriptContent = script.children.map((child: any) => child.data).join('')
          const transformedContent = transformJs({ path, source: scriptContent, executables })
          if (transformedContent !== undefined) {
            script.children[0].data = transformedContent
          }
        }
      })
    },
    toString() {
      return serialize(doc, { decodeEntities: true })
    },
  }
  return api
}
