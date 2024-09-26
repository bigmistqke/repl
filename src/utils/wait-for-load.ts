export function waitForEvent(element: Window | Element, event: string) {
  return new Promise<void>(resolve => {
    const handler = () => {
      resolve()
      element.removeEventListener(event, handler)
    }
    element.addEventListener(event, handler)
  })
}
