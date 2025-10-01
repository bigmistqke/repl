import serialize from 'dom-serializer'
import type { Element } from 'domhandler'
import { findAll, getAttributeValue, hasAttrib } from 'domutils'
import { parseDocument } from 'htmlparser2'
import type { Accessor } from 'solid-js'
import type { TransformConfig } from '../types.ts'
import * as PathUtils from './path-utils.ts'

export interface TransformHtmlWorkerConfig extends TransformConfig {
  transformModule(config: TransformConfig): Accessor<string>
}

export function transformHtmlWorker({
  path,
  source,
  fileUrls,
  transformModule,
}: TransformHtmlWorkerConfig) {
  const doc = parseDocument(source)

  const updatelinkHref = createUpdateFn(doc, 'link', link => {
    const href = getAttributeValue(link, 'href')!
    if (!href || PathUtils.isUrl(href)) return
    return () => {
      const url = fileUrls.get(PathUtils.resolvePath(path, href))
      if (url) link.attribs.href = url
    }
  })
  const updateScriptSrc = createUpdateFn(doc, 'script', script => {
    if (hasAttrib(script, 'src')) {
      const src = getAttributeValue(script, 'src')
      if (!src || PathUtils.isUrl(src)) return
      return () => {
        const url = fileUrls.get(PathUtils.resolvePath(path, src))
        if (url) script.attribs.src = url
      }
    }
  })
  const updateModuleTextContent = createUpdateFn(doc, 'script', script => {
    const childNode = script.children[0]
    const source = getAttributeValue(script, 'textContent')
    if (getAttributeValue(script, 'type') !== 'module' || !childNode || !source) return
    const transformed = transformModule({ path, fileUrls, source })
    return () => {
      if ('data' in childNode) {
        childNode.data = transformed()
      }
    }
  })

  return () => {
    updatelinkHref()
    updateScriptSrc()
    updateModuleTextContent()
    return serialize(doc, { decodeEntities: true })
  }
}

function createUpdateFn(
  doc: ReturnType<typeof parseDocument>,
  selector: string,
  callback: (element: Element) => (() => void) | undefined,
) {
  const updateFns = findAll(
    elem => !!(elem.tagName && elem.tagName.toLowerCase() === selector.toLowerCase()),
    doc.children,
  ).map(element => callback(element))
  return () => updateFns.forEach(updateFn => updateFn?.())
}
