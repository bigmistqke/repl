// Create a new DOMParser and XMLSerializer-instance
const domParser = new DOMParser()
const xmlSerializer = new XMLSerializer()

export function transformHtml(source: string) {
  const doc = domParser.parseFromString(source, 'text/html')
  const api = {
    transform<T extends Element>(selector: string, callback: (element: T) => void) {
      Array.from(doc.querySelectorAll<T>(selector)).forEach(callback)
      return api
    },
    toString() {
      return xmlSerializer.serializeToString(doc)
    },
  }
  return api
}
