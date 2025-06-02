import { defer } from '../utils/defer'

/**
 * Waits for an iframe to have a `contentWindow` available and returns it.
 *
 * If the iframe's `contentWindow` is not immediately available, waits for the iframe to load.
 *
 * @param iframe - The target iframe element.
 * @returns A promise that resolves with the iframe's `contentWindow`.
 */
export async function getContentWindow(iframe: HTMLIFrameElement) {
  const contentWindow = iframe.contentWindow

  if (!contentWindow) {
    await waitForLoad(iframe)
  }

  return iframe.contentWindow!
}

/**
 * Returns a promise that resolves when the given element emits a `load` event.
 *
 * @param element - The element to wait for (e.g., an `<iframe>`, `<script>`, or `<link>`).
 * @returns A promise that resolves when the element has loaded.
 */
export async function waitForLoad(element: Element) {
  const { resolve, promise } = defer()
  element.addEventListener('load', () => resolve())
  await promise
}

/**********************************************************************************/
/*                                                                                */
/*                                      Inject                                    */
/*                                                                                */
/**********************************************************************************/

/**
 * Injects an element into the `<head>` of an iframe's document and waits for it to load.
 *
 * @param iframe - The target iframe element.
 * @param getElement - A callback that receives the iframe's `contentWindow` and returns the element to inject.
 * @returns A promise that resolves with a function to remove the injected element.
 */
export async function inject(
  iframe: HTMLIFrameElement,
  getElement: (contentWindow: Window) => Element,
) {
  const contentWindow = await getContentWindow(iframe)

  const element = getElement(contentWindow)
  contentWindow.document.head.appendChild(element)

  await waitForLoad(element)

  return () => contentWindow!.document.head.removeChild(element)
}

/**
 * Injects a `<script>` tag into the `<head>` of an iframe and waits for it to load.
 *
 * @param iframe - The target iframe element.
 * @param url - The URL of the script to inject.
 * @param module - Whether to inject the script as a module (`type="module"`). Defaults to `true`.
 * @returns A promise that resolves with a function to remove the injected script.
 */
export async function injectScript(iframe: HTMLIFrameElement, url: string, module = true) {
  return inject(iframe, contentWindow => {
    const script = contentWindow.document.createElement('script')
    if (module) {
      script.type = 'module'
    }
    script.src = url
    return script
  })
}

/**
 * Injects a `<link rel="stylesheet">` tag into the `<head>` of an iframe and waits for it to load.
 *
 * @param iframe - The target iframe element.
 * @param url - The URL of the stylesheet to inject.
 * @returns A promise that resolves with a function to remove the injected link.
 */
export async function injectLink(iframe: HTMLIFrameElement, url: string) {
  return inject(iframe, contentWindow => {
    const link = contentWindow.document.createElement('link')
    link.setAttribute('rel', 'stylesheet')
    link.href = url
    return link
  })
}
